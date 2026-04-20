import { handle } from '@hono/node-server/vercel';
import app from '../src/app/index';

export default handle(app);
