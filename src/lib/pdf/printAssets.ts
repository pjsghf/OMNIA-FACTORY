export function buildPrintAssetsScript(): string {
  return `
    window.addEventListener('load', async function() {
      const printBtn = document.getElementById('print-button');
      const statusText = document.getElementById('print-status-text');

      if (printBtn) printBtn.disabled = true;
      if (statusText) statusText.textContent = 'Preparando imagens e fontes...';

      async function waitForAssets() {
        const images = Array.from(document.images);

        await Promise.all(
          images.map(async (image) => {
            try {
              if (!image.complete) {
                await new Promise((resolve) => {
                  image.addEventListener('load', resolve, { once: true });
                  image.addEventListener('error', resolve, { once: true });
                });
              }
              if (typeof image.decode === 'function') {
                await image.decode().catch(() => undefined);
              }
            } catch (err) {
              console.warn('Erro ao carregar imagem para impressão:', err);
            }
          })
        );

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      }

      await waitForAssets();

      if (printBtn) printBtn.disabled = false;
      if (statusText) statusText.textContent = 'Documento pronto para exportação.';
    });
  `;
}
