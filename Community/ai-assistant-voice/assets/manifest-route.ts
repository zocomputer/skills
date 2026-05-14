export default (c) => {
  return c.json({
    name: "{{ASSISTANT_NAME}} Voice",
    short_name: "{{ASSISTANT_NAME}}",
    version: "1.0.0",
    description: "Talk to {{ASSISTANT_NAME}} via voice — full-screen AI on any device",
    start_url: "{{PAGE_PATH}}",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    scope: "{{PAGE_PATH}}/",
    icons: [
      {
        src: "{{PORTRAIT_PATH}}",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["productivity", "utilities"],
  }, 200, {
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  });
};
