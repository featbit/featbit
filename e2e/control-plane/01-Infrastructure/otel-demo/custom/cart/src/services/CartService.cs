// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System;
using Grpc.Core;
using cart.cartstore;
using OpenFeature;
using Oteldemo;

namespace cart.services;

public class CartService : Oteldemo.CartService.CartServiceBase
{
    private static readonly Empty Empty = new();
    private readonly Random random = new Random();
    private readonly ICartStore _badCartStore;
    private readonly ICartStore _cartStore;
    private readonly IFeatureClient _featureFlagHelper;

    public CartService(ICartStore cartStore, ICartStore badCartStore, IFeatureClient featureFlagService)
    {
        _badCartStore = badCartStore;
        _cartStore = cartStore;
        _featureFlagHelper = featureFlagService;
    }

    public override async Task<Empty> AddItem(AddItemRequest request, ServerCallContext context)
    {
        var activity = Activity.Current;
        activity?.SetTag("app.user.id", request.UserId);
        activity?.SetTag("app.product.id", request.Item.ProductId);
        activity?.SetTag("app.product.quantity", request.Item.Quantity);

        // FeatBit native SDK flags (safe defaults when FeatBit is unconfigured /
        // unreachable / a flag is missing — see FeatBitFlags).
        var flags = FeatBitFlags.Instance;

        // cart-readonly-mode (ops): when enabled, AddItem is intentionally and
        // cleanly rejected. This is a deliberate feature, NOT a crash, so we
        // return a well-formed gRPC error rather than letting anything throw
        // unexpectedly.
        var readOnly = flags.CartReadonlyMode();
        activity?.SetTag("app.feature.cart_readonly_mode", readOnly);
        if (readOnly)
        {
            var rejection = new RpcException(new Status(
                StatusCode.FailedPrecondition,
                "Cart is in read-only mode; AddItem is temporarily disabled."));
            activity?.AddEvent(new("AddItem rejected: cart-readonly-mode is enabled"));
            activity?.SetStatus(ActivityStatusCode.Error, rejection.Status.Detail);
            throw rejection;
        }

        // cart-max-items (config): the configured maximum quantity per AddItem.
        // The flag value is applied verbatim with NO lower-bound sanitisation
        // (intentional resiliency gap). See the capacity check below.
        var maxItems = flags.CartMaxItems();
        activity?.SetTag("app.feature.cart_max_items", maxItems);

        try
        {
            // Allowed quantities are the inclusive range 1..maxItems. We build that
            // set straight from the flag value with no validation: a misconfigured
            // negative cart-max-items makes Enumerable.Range throw
            // ArgumentOutOfRangeException, which is NOT an RpcException and so
            // escapes the catch below and surfaces to the gRPC caller as a real
            // error. Default (100) and positive values are safe.
            var allowedQuantities = Enumerable.Range(1, maxItems);
            if (!allowedQuantities.Contains(request.Item.Quantity))
            {
                // Legitimate over-limit request: a clean, well-formed rejection.
                throw new RpcException(new Status(
                    StatusCode.ResourceExhausted,
                    $"Quantity {request.Item.Quantity} is not allowed; cart-max-items is {maxItems}."));
            }

            // cart-persistence-enabled (ops kill-switch): when disabled, skip the
            // Valkey/redis-backed write and fall back to a safe no-op. The call
            // still succeeds so upstream flows are non-breaking either way.
            var persistenceEnabled = flags.CartPersistenceEnabled();
            activity?.SetTag("app.feature.cart_persistence_enabled", persistenceEnabled);
            if (persistenceEnabled)
            {
                await _cartStore.AddItemAsync(request.UserId, request.Item.ProductId, request.Item.Quantity);
            }
            else
            {
                activity?.AddEvent(new("cart-persistence-enabled is false; AddItem not persisted"));
            }

            return Empty;
        }
        catch (RpcException ex)
        {
            activity?.AddException(ex);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    public override async Task<Cart> GetCart(GetCartRequest request, ServerCallContext context)
    {
        var activity = Activity.Current;
        activity?.SetTag("app.user.id", request.UserId);
        activity?.AddEvent(new("Fetch cart"));

        try
        {
            var cart = await _cartStore.GetCartAsync(request.UserId);
            var totalCart = 0;
            foreach (var item in cart.Items)
            {
                totalCart += item.Quantity;
            }
            activity?.SetTag("app.cart.items.count", totalCart);

            return cart;
        }
        catch (RpcException ex)
        {
            activity?.AddException(ex);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    public override async Task<Empty> EmptyCart(EmptyCartRequest request, ServerCallContext context)
    {
        var activity = Activity.Current;
        activity?.SetTag("app.user.id", request.UserId);
        activity?.AddEvent(new("Empty cart"));

        try
        {
            if (await _featureFlagHelper.GetBooleanValueAsync("cartFailure", false))
            {
                await _badCartStore.EmptyCartAsync(request.UserId);
            }
            else
            {
                await _cartStore.EmptyCartAsync(request.UserId);
            }
        }
        catch (RpcException ex)
        {
            Activity.Current?.AddException(ex);
            Activity.Current?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }

        return Empty;
    }
}
