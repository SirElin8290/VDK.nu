// VDK:s publika webb använder API-domänen. Lokalt och på Worker-adressen används samma server.
const vdkPublicHost = ['vdk.nu', 'www.vdk.nu'].includes(window.location.hostname);
window.VDK_CONFIG = {
  apiBase: vdkPublicHost ? 'https://api.vdk.nu' : '',
  membershipQrPdf: 'assets/swish-qr.pdf',
  statutesUrl: 'assets/stadgar-vdk.pdf'
};
