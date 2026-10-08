import { handleSampleRequest } from "../lib/sample-server";
import { createD1MetadataCache } from "../db/cache";
export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    return handleSampleRequest(request, env.FREESOUND_API_KEY, createD1MetadataCache(env.DB));
  },
};
