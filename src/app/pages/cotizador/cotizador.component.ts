import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// El cotizador es un HTML autocontenido (trae su propio CSS con reset global y
// su propio html2pdf embebido). Va en un iframe para aislarlo: así su `*{}` no
// pisa los estilos Tailwind del dashboard y su PDF sigue funcionando igual.
// El archivo vive en src/assets/cotizador.html (Angular lo sirve en /assets).
@Component({
  selector: 'app-cotizador',
  standalone: true,
  template: `
    <div class="h-[calc(100vh-2rem)] w-full">
      <iframe
        [src]="url"
        title="Cotizador SENDA"
        class="w-full h-full border-0 rounded-xl bg-white"
        loading="lazy"></iframe>
    </div>
  `,
})
export class CotizadorComponent {
  url: SafeResourceUrl;

  constructor(sanitizer: DomSanitizer) {
    // bypassSecurity: el HTML es nuestro, servido desde el mismo origen.
    this.url = sanitizer.bypassSecurityTrustResourceUrl('assets/cotizador.html');
  }
}
