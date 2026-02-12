using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Messages
{
    public interface IMessageConsumer
    {
        public string Topic { get; }

        Task HandleAsync(string message, CancellationToken cancellationToken);
    }
}
