/**
 * Extends app.json. EXPO_BASE_URL is set only when the web build is published under a sub-path
 * (GitHub Pages serves the site at /<repo-name>/).
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
