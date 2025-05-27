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
    const s = "000000000000" + param;
    const numberWithLeadingZeros = s.slice(s.length - length);
    return numberWithLeadingZeros.split('').map(n => alphabet[n]).join('');
}

export function generateConnectionToken(text) {
    text = text.replace(/=*$/, '');
    const timestamp = Date.now();
    const timestampCode = encodeNumber(timestamp, timestamp.toString().length);
    const start = Math.max(Math.floor(Math.random() * text.length), 2);

    return `${encodeNumber(start, 3)}${encodeNumber(timestampCode.length, 2)}${text.slice(0, start)}${timestampCode}${text.slice(start)}`;
}