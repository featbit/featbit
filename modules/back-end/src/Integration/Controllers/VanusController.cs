using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FeatBit.Integration.Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VanusController : ControllerBase
    {
        private readonly ILogger<VanusController> _logger;

        public VanusController(ILogger<VanusController> logger)
        {
            _logger = logger;
        }
    }
}
