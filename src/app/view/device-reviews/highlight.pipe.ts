import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ standalone: false, name: 'highlight', pure: false })
export class HighlightPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string, term: string): SafeHtml {
    const escaped = value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]!,
    );
    if (!term.trim()) return escaped;
    const escapedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const highlighted = escaped.replace(
      new RegExp(escapedTerm, 'gi'), // nosemgrep: detect-non-literal-regexp -- term is regex-escaped above
      (m) => `<mark class="search-highlight">${m}</mark>`,
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted); // nosemgrep: angular-bypasssecuritytrust -- HTML-escaped value, regex-escaped term
  }
}
