using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Api.Public;
using Api.Setup;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Xunit;

namespace Api.UnitTests.Controllers
{
    public class InsightControllerTests
    {
        private readonly IMessageProducer _mockProducer;

        private readonly InsightController _controller;

        private readonly string _authorizationHeader = "upuxakaSgkOUwI2SEHBVcQYKcQriB8cU-L3_-0hYUhnw";

        public InsightControllerTests()
        {
            _mockProducer = Mock.Of<IMessageProducer>();
            var memoryCache = new MemoryCache(new MemoryCacheOptions());

            var mockBoundedMemoryCache = Mock.Of<IBoundedMemoryCache>(x => x.Instance == memoryCache); ;

            _controller = new InsightController(_mockProducer, mockBoundedMemoryCache);
        }

        [Fact]
        public async Task TrackAsync_Unauthorized_ReturnsUnauthorized()
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
                {
                    Request = { Headers = { ["Authorization"] = "bad-secret" } }
                }
            };

            var result = await _controller.TrackAsync(new List<Insight>());

            Assert.IsType<UnauthorizedResult>(result);
        }

        [Fact]
        public async Task TrackAsync_NoValidInsights_ReturnsOk()
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
                {
                    Request = { Headers = { ["Authorization"] = _authorizationHeader } }
                }
            };

            var insights = new List<Insight>
            {
                new Insight
                {
                    /* Invalid Insight */
                }
            };

            var result = await _controller.TrackAsync(insights);

            Assert.IsType<OkResult>(result);
        }

        [Fact]
        public async Task TrackAsync_ValidInsights_ProcessesMessages()
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
                {
                    Request = { Headers = { ["Authorization"] = _authorizationHeader } }
                }
            };

            var insights = new List<Mock<Insight>>
            {
                new Mock<Insight>(),
                new Mock<Insight>(),
            };

            foreach (var mockInsight in insights)
            {
                mockInsight.Setup(x => x.IsValid()).Returns(true); // Mock valid insights
                mockInsight.Setup(x => x.User).Returns(new EndUser { KeyId = "user-key" });
                mockInsight.Setup(x => x.EndUserMessage(It.IsAny<Guid>()))
                    .Returns(new EndUserMessage(It.IsAny<Guid>(), new EndUser { KeyId = "user-key" }));
                mockInsight.Setup(x => x.InsightMessages(It.IsAny<Guid>()))
                    .Returns(new List<InsightMessage> { new InsightMessage() });
            }

            var insightObjects = insights.Select(mock => mock.Object).ToList();

            var result = await _controller.TrackAsync(insightObjects);

            Assert.IsType<OkResult>(result);
            Mock.Get(_mockProducer).Verify(x => x.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()),
                Times.Once);
            Mock.Get(_mockProducer).Verify(x => x.PublishAsync(Topics.Insights, It.IsAny<InsightMessage>()),
                Times.Exactly(2));
        }
    }
}