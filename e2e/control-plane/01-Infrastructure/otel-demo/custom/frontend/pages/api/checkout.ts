// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit overlay: evaluates the `experiment-checkout-button-variant` A/B
// experiment SERVER-SIDE and returns the chosen variant (plus its rendered
// button label) on the checkout response for the UI to render.
//
// INTENTIONAL RESILIENCY GAP (unknown-variant): the label is resolved with an
// UNCHECKED map lookup. For the known, safe variants (control | variant-a |
// variant-b) this works. For any UNRECOGNIZED variant — e.g. an operator typo
// in the flag config — the lookup yields `undefined`, and calling a string
// method on it throws a real TypeError. That error propagates out of the
// handler, is recorded by InstrumentationMiddleware, and the route returns 500.
// Surfacing how the app copes with a bad-but-present flag value is the point of
// the exercise, so we deliberately do NOT guard this lookup.

import type { NextApiRequest, NextApiResponse } from 'next';
import { context, trace } from '@opentelemetry/api';
import InstrumentationMiddleware from '../../utils/telemetry/InstrumentationMiddleware';
import CheckoutGateway from '../../gateways/rpc/Checkout.gateway';
import { Empty, PlaceOrderRequest } from '../../protos/demo';
import { IProductCheckoutItem, IProductCheckout } from '../../types/Cart';
import ProductCatalogService from '../../services/ProductCatalog.service';
import { FLAG_CHECKOUT_BUTTON_VARIANT, getCheckoutButtonVariant } from '../../utils/featbit/FeatBit';

type TResponse = (IProductCheckout & { checkoutButtonVariant: string; checkoutButtonLabel: string }) | Empty;

// Known, safe variants only. Unknown variants are intentionally absent so the
// unchecked lookup below fails loudly (see file header).
const CHECKOUT_BUTTON_LABELS: Record<string, string> = {
  control: 'Place Order',
  'variant-a': 'Buy Now',
  'variant-b': 'Complete Purchase',
};

const handler = async ({ method, body, query }: NextApiRequest, res: NextApiResponse<TResponse>) => {
  switch (method) {
    case 'POST': {
      const { currencyCode = '' } = query;
      const orderData = body as PlaceOrderRequest;
      const { order: { items = [], ...order } = {} } = await CheckoutGateway.placeOrder(orderData);

      const productList: IProductCheckoutItem[] = await Promise.all(
        items.map(async ({ item: { productId = '', quantity = 0 } = {}, cost }) => {
          const product = await ProductCatalogService.getProduct(productId, currencyCode as string);

          return {
            cost,
            item: {
              productId,
              quantity,
              product,
            },
          };
        })
      );

      // A/B experiment (safe default "control"). Evaluated server-side.
      const checkoutButtonVariant = await getCheckoutButtonVariant();
      trace
        .getSpan(context.active())
        ?.setAttribute(`app.featbit.${FLAG_CHECKOUT_BUTTON_VARIANT}`, checkoutButtonVariant);

      // Intentional unknown-variant gap: unchecked lookup. An unrecognized
      // variant yields `undefined` here and `.toUpperCase()` throws a TypeError
      // -> 500 from this route. Known variants are safe.
      const checkoutButtonLabel = CHECKOUT_BUTTON_LABELS[checkoutButtonVariant].toUpperCase();

      return res.status(200).json({ ...order, items: productList, checkoutButtonVariant, checkoutButtonLabel });
    }

    default: {
      return res.status(405).send('');
    }
  }
};

export default InstrumentationMiddleware(handler);
