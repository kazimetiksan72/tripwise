export default function handler(_req, res) {
  return res.status(200).json({
    status: "ok",
    databaseConfigured: Boolean(process.env.MONGODB_URI),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    appleAudienceConfigured: Boolean(process.env.APPLE_IOS_BUNDLE_ID || "com.pikselmutfak.tripwise"),
  });
}
