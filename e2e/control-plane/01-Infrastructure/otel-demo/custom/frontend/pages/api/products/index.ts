// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit overlay: evaluates the `release-redesigned-product-page` release-gate
// flag SERVER-SIDE and exposes the boolean to the page so it can toggle the
// redesigned product layout. The product JSON shape (Product[]) is unchanged —
// the flag rides on a response header — so the storefront renders identically
// whether FeatBit is reachable or not (safe either way).

import type { NextApiRequest, NextApiResponse } from 'next';
import { context, trace } from '@opentelemetry/api';
import InstrumentationMiddleware from '../../../utils/telemetry/InstrumentationMiddleware';
import { Empty, Product } from '../../../protos/demo';
import ProductCatalogService from '../../../services/ProductCatalog.service';
import {
  FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE,
  getReleaseRedesignedProductPage,
} from '../../../utils/featbit/FeatBit';

type TResponse = Product[] | Empty;

const handler = async ({ method, query }: NextApiRequest, res: NextApiResponse<TResponse>) => {
  switch (method) {
    case 'GET': {
      const { currencyCode = '' } = query;
      const productList = await ProductCatalogService.listProducts(currencyCode as string);

      // Release gate (safe default OFF). Server-side evaluation; the value is
      // surfaced to the page via a response header so the JSON body stays a
      // plain Product[].
      const redesigned = await getReleaseRedesignedProductPage();
      trace
        .getSpan(context.active())
        ?.setAttribute(`app.featbit.${FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE}`, redesigned);
      res.setHeader(`x-featbit-${FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE}`, String(redesigned));

      return res.status(200).json(productList);
    }

    default: {
      return res.status(405).send('');
    }
  }
};

export default InstrumentationMiddleware(handler);
