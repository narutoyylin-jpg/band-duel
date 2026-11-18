import handler from 'vinext/server/fetch-handler';
import {D1SeasonStore} from '../seasons.mjs';

export default {
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    await new D1SeasonStore(env.DB).settleDue(controller.scheduledTime);
  },
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};
