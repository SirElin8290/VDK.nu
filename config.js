// Publik registrering går till den befintliga medlemstjänsten.
// Inloggning öppnas på medlemstjänstens egen adress så att sessionskakan fungerar även på mobil.
const vdkPublicHost = ['vdk.nu', 'www.vdk.nu'].includes(window.location.hostname);
window.VDK_CONFIG = {
  apiBase: vdkPublicHost ? 'https://vdk-members.soren-johansson-7.workers.dev' : '',
  membershipQrPdf: 'assets/swish-qr.pdf',
  statutesUrl: 'assets/stadgar-vdk.pdf'
};
