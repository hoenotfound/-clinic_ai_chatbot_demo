const SOURCES = [
  {
    key: "hifu-facebook",
    label: "HIFU Facebook Ad",
    source: "Meta Ads",
    campaign: "HIFU Jawline Demo Campaign",
    channel: "facebook",
    treatment: "HIFU Skin Lifting",
  },
  {
    key: "pico-instagram",
    label: "Pico Instagram Ad",
    source: "Meta Ads",
    campaign: "Pico Pigmentation Demo Campaign",
    channel: "instagram",
    treatment: "Pico Laser",
  },
  {
    key: "organic-whatsapp",
    label: "Organic WhatsApp",
    source: "Organic",
    campaign: null,
    channel: "whatsapp",
    treatment: null,
  },
  {
    key: "referral",
    label: "Referral",
    source: "Referral",
    campaign: null,
    channel: "whatsapp",
    treatment: null,
  },
];

const DEFAULT_SOURCE_KEY = "organic-whatsapp";

function getAcquisitionSource(key) {
  return SOURCES.find((item) => item.key === key) || SOURCES.find((item) => item.key === DEFAULT_SOURCE_KEY);
}

module.exports = {
  SOURCES,
  DEFAULT_SOURCE_KEY,
  getAcquisitionSource,
};
