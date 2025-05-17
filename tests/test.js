const WebSocket = require('ws');
const readline = require('readline');

if (process.argv.length < 3) {
    console.error('Usage: ws-test.js <websocket_url>');
    process.exit(1);
}

const url = process.argv[2];
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log(`Connected to ${url}`);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Send> '
    });

    rl.prompt();

    rl.on('line', (line) => {
        ws.send(line);
        rl.prompt();
    }).on('close', () => {
        ws.close();
        process.exit(0);
    });
});

ws.on('message', (data) => {
    console.log(`Received: ${data}`);
});

ws.on('close', () => {
    console.log('Connection closed');
});

ws.on('error', (err) => {
    console.error(`Error: ${err.message}`);
});