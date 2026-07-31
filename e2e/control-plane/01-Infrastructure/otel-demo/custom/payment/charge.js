// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
const { context, propagation, trace, metrics } = require('@opentelemetry/api');
const cardValidator = require('simple-card-validator');
const { v4: uuidv4 } = require('uuid');

const { OpenFeature } = require('@openfeature/server-sdk');
const { FlagdProvider } = require('@openfeature/flagd-provider');
const flagProvider = new FlagdProvider();

// FeatBit native Node SDK flag accessors (see featbit.js). Initialized once at
// startup in index.js; every getter degrades to a safe default when FeatBit is
// unreachable, so the charge path keeps working with no flag backend.
const featbit = require('./featbit');

const logger = require('./logger');
const tracer = trace.getTracer('payment');
const meter = metrics.getMeter('payment');
const transactionsCounter = meter.createCounter('app.payment.transactions');

const LOYALTY_LEVEL = ['platinum', 'gold', 'silver', 'bronze'];

// Known payment provider paths. The lookup against this map is intentionally
// UNCHECKED in the charge path: an unknown `payment-provider` flag value
// resolves to `undefined` and calling it throws — surfacing the unknown-variant
// resiliency gap. "default" and the named providers are safe.
const PAYMENT_PROVIDERS = {
  default: transactionId => ({ provider: 'default', authCode: transactionId.slice(0, 8) }),
  'visa-direct': transactionId => ({ provider: 'visa-direct', authCode: transactionId.slice(0, 8) }),
  braintree: transactionId => ({ provider: 'braintree', authCode: transactionId.slice(0, 8) }),
};

/** Return random element from given array */
function random(arr) {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

module.exports.charge = async request => {
  const span = tracer.startSpan('charge');

  await OpenFeature.setProviderAndWait(flagProvider);

  const numberVariant =  await OpenFeature.getClient().getNumberValue("paymentFailure", 0);

  if (numberVariant > 0) {
    // n% chance to fail with app.loyalty.level=gold
    if (Math.random() < numberVariant) {
      span.setAttributes({'app.loyalty.level': 'gold' });
      span.end();

      throw new Error('Payment request failed. Invalid token. app.loyalty.level=gold');
    }
  }

  const {
    creditCardNumber: number,
    creditCardExpirationYear: year,
    creditCardExpirationMonth: month
  } = request.creditCard;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const lastFourDigits = number.substr(-4);
  const transactionId = uuidv4();

  const card = cardValidator(number);
  const { card_type: cardType, valid } = card.getCardDetails();

  const loyalty_level = random(LOYALTY_LEVEL);

  span.setAttributes({
    'app.payment.card_type': cardType,
    'app.payment.card_valid': valid,
    'app.loyalty.level': loyalty_level
  });

  if (!valid) {
    throw new Error('Credit card info is invalid.');
  }

  if (!['visa', 'mastercard'].includes(cardType)) {
    throw new Error(`Sorry, we cannot process ${cardType} credit cards. Only VISA or MasterCard is accepted.`);
  }

  if ((currentYear * 12 + currentMonth) > (year * 12 + month)) {
    throw new Error(`The credit card (ending ${lastFourDigits}) expired on ${month}/${year}.`);
  }

  // ---------------------------------------------------------------------------
  // FeatBit feature flags (native Node SDK). Each evaluation is async and is
  // awaited here. All three are recorded as span attributes for observability.
  // ---------------------------------------------------------------------------

  // (1) payment-fraud-check-enabled (bool, ops kill-switch, default true).
  //     Gates a safe, simulated fraud-check step. Turning it off only skips the
  //     extra check; it never breaks the charge.
  const fraudCheckEnabled = await featbit.fraudCheckEnabled();
  span.setAttribute('app.payment.fraud_check_enabled', fraudCheckEnabled);
  if (fraudCheckEnabled) {
    // Simulated, deterministic-ish fraud score — purely illustrative.
    const fraudScore = Math.round(Math.random() * 100) / 100;
    span.setAttribute('app.payment.fraud_score', fraudScore);
    logger.info({ transactionId, fraudScore }, 'Fraud check performed.');
  }

  // (2) payment-provider (string, experiment, default "default").
  //     Selects the provider path via an UNCHECKED lookup: an unknown variant
  //     yields `undefined` and the call below throws (intentional gap).
  const provider = await featbit.paymentProvider();
  span.setAttribute('app.payment.provider', provider);
  const providerHandler = PAYMENT_PROVIDERS[provider];
  // No guard on purpose: unknown provider -> providerHandler is undefined ->
  // TypeError ("providerHandler is not a function"). Known providers are safe.
  const providerResult = providerHandler(transactionId);
  span.setAttribute('app.payment.provider_auth_code', providerResult.authCode);

  // (3) payment-retry-attempts (number, config, default 0).
  //     Retries on a simulated transient provider failure. Applied WITHOUT
  //     validation: a negative value throws RangeError when the retry schedule
  //     is allocated; an absurdly large value yields a clearly broken loop.
  //     Default 0 and small positive values are safe.
  const retryAttempts = await featbit.paymentRetryAttempts();
  span.setAttribute('app.payment.retry_attempts', retryAttempts);

  // Unchecked allocation: `new Array(-1)` -> RangeError "Invalid array length";
  // `new Array(1e12)` -> a length that makes the loop below effectively endless.
  const retrySchedule = new Array(retryAttempts);

  // Simulate a transient provider failure and retry up to retrySchedule.length
  // additional times. The first attempt is attempt 0.
  let charged = false;
  let lastError = null;
  for (let attempt = 0; attempt <= retrySchedule.length; attempt++) {
    span.setAttribute('app.payment.charge_attempts', attempt + 1);
    try {
      // ~15% simulated transient failure on each attempt.
      if (Math.random() < 0.15) {
        throw new Error('Transient payment provider error.');
      }
      charged = true;
      break;
    } catch (err) {
      lastError = err;
      logger.warn({ transactionId, attempt, err }, 'Charge attempt failed; will retry if attempts remain.');
    }
  }
  if (!charged) {
    span.recordException(lastError);
    span.end();
    throw lastError;
  }

  // Check baggage for synthetic_request=true, and add charged attribute accordingly
  const baggage = propagation.getBaggage(context.active());
  if (baggage && baggage.getEntry('synthetic_request') && baggage.getEntry('synthetic_request').value === 'true') {
    span.setAttribute('app.payment.charged', false);
  } else {
    span.setAttribute('app.payment.charged', true);
  }

  const { units, nanos, currencyCode } = request.amount;
  logger.info({ transactionId, cardType, lastFourDigits, amount: { units, nanos, currencyCode }, loyalty_level, provider }, 'Transaction complete.');
  transactionsCounter.add(1, { 'app.payment.currency': currencyCode });
  span.end();

  return { transactionId };
};
