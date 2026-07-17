// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit overlay: evaluates the `operational-recommendations-enabled` ops
// toggle SERVER-SIDE. When the flag is OFF the route short-circuits and returns
// an empty recommendation list — graceful degradation, e.g. to shed load or
// when the recommendation service is unhealthy. Safe either way; the default is
// ON so behavior is unchanged unless an operator flips it.

import type { NextApiRequest, NextApiResponse } from 'next';
import { context, trace } from '@opentelemetry/api';
import InstrumentationMiddleware from '../../utils/telemetry/InstrumentationMiddleware';
import RecommendationsGateway from '../../gateways/rpc/Recommendations.gateway';
import { Empty, Product } from '../../protos/demo';
import ProductCatalogService from '../../services/ProductCatalog.service';
import { FLAG_RECOMMENDATIONS_ENABLED, getRecommendationsEnabled } from '../../utils/featbit/FeatBit';

type TResponse = Product[] | Empty;

const handler = async ({ method, query }: NextApiRequest, res: NextApiResponse<TResponse>) => {
  switch (method) {
    case 'GET': {
      const { productIds = [], sessionId = '', currencyCode = '' } = query;

      const recommendationsEnabled = await getRecommendationsEnabled();
      trace
        .getSpan(context.active())
        ?.setAttribute(`app.featbit.${FLAG_RECOMMENDATIONS_ENABLED}`, recommendationsEnabled);

      // Ops kill switch: degrade gracefully to an empty list when disabled.
      if (!recommendationsEnabled) {
        return res.status(200).json([]);
      }

      const { productIds: productList } = await RecommendationsGateway.listRecommendations(
        sessionId as string,
        productIds as string[]
      );
      const recommendedProductList = await Promise.all(
        productList.slice(0, 4).map(id => ProductCatalogService.getProduct(id, currencyCode as string))
      );

      return res.status(200).json(recommendedProductList);
    }

    default: {
      return res.status(405).send('');
    }
  }
};

export default InstrumentationMiddleware(handler);
