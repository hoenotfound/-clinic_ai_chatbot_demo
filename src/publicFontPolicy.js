const http = require('http');

/*
 * The public demo intentionally mirrors the DA Smarketing website typography,
 * which loads Plus Jakarta Sans from Google Fonts.
 *
 * Keep the Clinic Dashboard CSP unchanged. We only extend the public-page
 * policy (identified by frame-ancestors 'none') with the two Google font
 * origins used by the main DA website.
 */
const originalSetHeader = http.ServerResponse.prototype.setHeader;

http.ServerResponse.prototype.setHeader = function setHeaderWithPublicFontPolicy(name, value) {
  if (
    String(name).toLowerCase() === 'content-security-policy' &&
    typeof value === 'string' &&
    value.includes("frame-ancestors 'none'")
  ) {
    let next = value.replace(
      "style-src 'self'",
      "style-src 'self' https://fonts.googleapis.com"
    );

    if (!next.includes('font-src ')) {
      next = next.replace(
        "script-src 'self';",
        "font-src 'self' https://fonts.gstatic.com; script-src 'self';"
      );
    }

    return originalSetHeader.call(this, name, next);
  }

  return originalSetHeader.call(this, name, value);
};
