using System.Net.Http.Headers;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Application.Caches;
using Application.Services;
using Application.Users;
using Domain.Users;
using Infrastructure.Kafka;
using Infrastructure.Redis;
using Infrastructure.Users;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(collection =>
        {
            var userStore = new ServiceDescriptor(typeof(IUserStore),
                typeof(InMemoryUserStore),
                ServiceLifetime.Scoped
            );
            var passwordHasher = new ServiceDescriptor(
                typeof(IPasswordHasher<User>),
                typeof(TestPasswordHasher),
                ServiceLifetime.Scoped
            );
            var currentUser = ServiceDescriptor.Singleton<ICurrentUser>(new TestCurrentUser(TestUser.Id));

            collection.Replace(userStore);
            collection.Replace(passwordHasher);
            collection.Replace(currentUser);

            collection.Replace(ServiceDescriptor.Singleton<IRedisClient, TestRedisClient>());
            collection.Replace(ServiceDescriptor.Transient<ICachePopulatingService, TestCachePopulatingService>());

            // remove the kafka consumer from the test application because it is not needed
            var kafkaConsumerService =
                collection.FirstOrDefault(x => x.ImplementationType == typeof(KafkaMessageConsumer));
            if (kafkaConsumerService != null)
            {
                collection.Remove(kafkaConsumerService);
            }
        });

        // filtering ExceptionHandlerMiddleware logs 
        builder.ConfigureLogging(
            logging => logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None)
        );
    }

    public async Task<HttpResponseMessage> GetAsync(string uri, bool authenticated = true)
    {
        var client = CreateClient();
        if (authenticated)
        {
            AddAuthorizationHeader(client);
        }

        return await client.GetAsync(uri);
    }

    public async Task<HttpResponseMessage> PostAsync(
        string uri,
        object payload,
        bool authenticated = true)
    {
        var client = CreateClient();
        if (authenticated)
        {
            AddAuthorizationHeader(client);
        }

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PostAsync(uri, content);
    }

    public string GetToken(User user)
    {
        var scopeFactory = Services.GetRequiredService<IServiceScopeFactory>();
        using var scope = scopeFactory.CreateScope();
        var identityService = scope.ServiceProvider.GetRequiredService<IIdentityService>();

        var token = identityService.IssueToken(user);
        return token;
    }

    private void AddAuthorizationHeader(HttpClient client)
    {
        var token = GetToken(TestUser.Instance());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            JwtBearerDefaults.AuthenticationScheme, token
        );
    }
}