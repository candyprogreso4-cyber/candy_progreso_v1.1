import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyCop',
  standalone: true,
})
export class CurrencyCopPipe implements PipeTransform {
  transform(value: number | string | null | undefined, showSuffix = false): string {
    if (value === null || value === undefined || value === '') return '$0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0';

    const formatted = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(num);

    return showSuffix ? `${formatted} COP` : formatted;
  }
}
