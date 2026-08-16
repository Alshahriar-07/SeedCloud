// Vercel serverless entry point.
//
// Vercel does not run `node server/index.js`. Instead it imports this module as
// a serverless function. The full Express app (all /api/* routes) is exported
// here; `server/index.js` only calls app.listen() when NOT running on Vercel.
import app from '../server/index.js';

export default app;