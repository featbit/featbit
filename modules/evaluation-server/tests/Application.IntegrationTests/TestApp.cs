﻿using System.Net.WebSockets;
using Domain.Shared;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using Streaming.Connections;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(DbProvider.SectionName, DbProvider.Fake);
        builder.UseSetting(MqProvider.SectionName, MqProvider.None);
        builder.UseSetting(CacheProvider.SectionName, CacheProvider.None);

        base.ConfigureWebHost(builder);
    }

    public async Task<WebSocket> ConnectAsync(long timestamp = 0, string queryString = "")
    {
        var streamingApp = WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(timestamp)));
            });
        });

        var client = streamingApp.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming{queryString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        return ws;
    }

    public async Task<WebSocket> ConnectWithTokenAsync(string type = "client")
    {
        var (tokenCreatedAt, token) = type switch
        {
            ConnectionType.Client => (TestData.ClientToken.Timestamp, TestData.ClientTokenString),
            ConnectionType.Server => (TestData.ServerToken.Timestamp, TestData.ServerTokenString),
            ConnectionType.RelayProxy => (0, TestData.RelayProxyTokenString),
            _ => throw new ArgumentException("Invalid connection type", nameof(type))
        };

        return await ConnectAsync(tokenCreatedAt, $"?type={type}&version=2&token={token}");
    }
}