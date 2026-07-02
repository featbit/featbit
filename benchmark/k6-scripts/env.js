import { generateConnectionToken } from './utils.js';

export const ELS_SERVER = "ws://192.168.0.107:5100";
export const CLIENT_SECRET = "RPFbPRm86EqQhXekJMvUmAavMwf4q73kmErGUufm8hGg";
export const SERVER_SECRET = "kFla6VX0KEabUMLk7om-0AavMwf4q73kmErGUufm8hGg";

export const STREAMING_CLIENT_URL = `${ELS_SERVER}/streaming?type=client&token=${generateConnectionToken(CLIENT_SECRET)}`;
export const STREAMING_SERVER_URL = `${ELS_SERVER}/streaming?type=server&token=${generateConnectionToken(SERVER_SECRET)}`;