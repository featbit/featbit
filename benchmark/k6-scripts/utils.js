import { setTimeout } from 'k6/experimental/timers';

/********************** encode text begin *****************************/
const alphabet = {
    "0": "Q",
    "1": "B",
    "2": "W",
    "3": "S",
    "4": "P",
    "5": "H",
    "6": "D",
    "7": "X",
    "8": "Z",
    "9": "U",
}

function encodeNumber(param, length) {
    var s = "000000000000" + param;
    const numberWithLeadingZeros = s.slice(s.length - length);
    return numberWithLeadingZeros.split('').map(n => alphabet[n]).join('');
}

// generate connection token
export function generateConnectionToken(text) {
    text = text.replace(/=*$/, '');
    const timestamp = Date.now();
    const timestampCode = encodeNumber(timestamp, timestamp.toString().length);
    // get random number less than the length of the text as the start point, and it must be greater or equal to 2
    const start = Math.max(Math.floor(Math.random() * text.length), 2);

    return `${encodeNumber(start, 3)}${encodeNumber(timestampCode.length, 2)}${text.slice(0, start)}${timestampCode}${text.slice(start)}`;
}

/********************** encode text end *****************************/

const WebSocketState = {
    OPEN: 1
}

export function sendPingMessage (socket, pingCounter) {
    const payload = {
        messageType: 'ping',
        data: null
    };


    setTimeout(() => {
        try {
            if (socket.readyState == WebSocketState.OPEN) { // cannot use === as socket.readyState is an object
                //console.log('sendPingMessage: sending ping');
                socket.send(JSON.stringify(payload));
                sendPingMessage(socket, pingCounter);
                if(pingCounter) {
                    pingCounter.add(1);
                }
            }
        } catch (err) {
            console.log(`sendPingMessage - err: ${err}`);
        }
    }, 18 * 1000);
}

export function sendUserIdentifyMessage (socket, timestamp, user) {
    const { name, keyId, customizedProperties } = user;
    const payload = {
        messageType: 'data-sync',
        data: {
            user: {
                name,
                keyId,
                customizedProperties,
            },
            timestamp
        }
    };

    try {
        if (socket.readyState == WebSocketState.OPEN) { // cannot use === as socket.readyState is an object
            //console.log('sendUserIdentifyMessage: sending user identify message');
            socket.send(JSON.stringify(payload));
        } else {
            console.log(`sendUserIdentifyMessage - ERR: didn't send user identify message because socket not open`);
        }
    } catch (err) {
        console.log(`sendUserIdentifyMessage - err: ${err}`);
    }
}