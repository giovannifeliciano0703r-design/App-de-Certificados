import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.mil.eb.certificados",
  appName: "Gerador de Certificados",
  webDir: "mobile-shell",
  server: {
    url: "https://app-certificados-segex.giovannifeliciano070.chatgpt.site",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
