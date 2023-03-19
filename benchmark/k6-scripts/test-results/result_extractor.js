// This is a node js file
const fs = require('fs');
const path = require('path');

const columns = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)', 'p(99.99)'];
const header = ['throughput', 'iteration', ...columns].join(',');

const writeStream = fs.createWriteStream('summary.csv');
writeStream.write(`${header}\n`);

const results = fs.readdirSync('./t2.micro')
    .filter(filename => path.extname(filename) === '.json')
    .map(filename => {
        const [throughput, iteration] = filename.split('.')[1].split('_');

        const content = JSON.parse(fs.readFileSync(`./results/${filename}`, {encoding:'utf8', flag:'r'}));
        const csvStr = columns.map(col => content['metrics']['latency']['values'][col]).join(',');

        return [throughput, iteration, csvStr];
    })
    .sort((a, b) => {
        if (a[0] < b[0]) {
            return -1;
        }

        if (a[0] > b[0]) {
            return 1;
        }

        if (a[0] === b[0]) {
            if (a[1] < b[1]) {
                return -1;
            }

            if (a[1] > b[1]) {
                return 1;
            }

            if (a[1] === b[1]) {
                return 0;
            }
        }
    }).forEach((data) => writeStream.write(`${data.join(',')}\n`));


