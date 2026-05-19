const http = require('http');

async function main() {
    const url = 'http://localhost:3000/api/v1/token/top-movers/SOUL?windowDays=7&limit=50';
    
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.log('Status Code:', res.statusCode);
                console.log('Body:', data);
                return;
            }
            try {
                const movers = JSON.parse(data);
                const targetAddress = 'P2K4gBGN4fTez9yonEsSWi8zqjasUyRSVoBMMvjahJGjg3Z';
                const mover = movers.find(m => m.address === targetAddress);
                
                if (mover) {
                    console.log('Address:', mover.address);
                    console.log('Latest Balance:', mover.latestBalance);
                    console.log('Baseline Balance:', mover.baselineBalance);
                    console.log('Delta Balance:', mover.deltaBalance);
                    console.log('Delta Pct:', mover.deltaPct);
                    
                    const calc1 = (mover.deltaBalance / mover.baselineBalance) * 100;
                    const calc2 = (mover.deltaBalance / mover.latestBalance) * 100;
                    
                    console.log('(deltaBalance / baselineBalance * 100):', calc1);
                    console.log('(deltaBalance / latestBalance * 100):', calc2);
                } else {
                    console.log('Address ' + targetAddress + ' not found in top 50 movers.');
                }
            } catch (e) {
                console.error('Error parsing JSON:', e.message);
            }
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
}

main();
