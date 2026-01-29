import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SoapService {
  private readonly endpoint = this.resolveEndpoint();

  constructor(private http: HttpClient) {}

  call(operation: string, bodyXml: string): Observable<Element> {
    const envelope = this.buildEnvelope(operation, bodyXml);
    const headers = new HttpHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: operation
    });

    return this.http.post(this.endpoint, envelope, { headers, responseType: 'text' }).pipe(
      map((xml) => this.parseResponse(xml, operation))
    );
  }

  buildElements(fields: Record<string, string | number | boolean | null | undefined>): string {
    return Object.entries(fields)
      .map(([key, value]) => {
        const safeValue = value == null ? '' : this.escapeXml(String(value));
        return `<${key}>${safeValue}</${key}>`;
      })
      .join('');
  }

  getText(parent: Element, localName: string): string {
    const child = this.getChildElement(parent, localName);
    return (child?.textContent ?? '').trim();
  }

  getNumber(parent: Element, localName: string): number {
    const raw = this.getText(parent, localName);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  getBoolean(parent: Element, localName: string): boolean {
    const raw = this.getText(parent, localName).toLowerCase();
    return raw === 'true' || raw === '1';
  }

  getChildElement(parent: Element, localName: string): Element | null {
    const children = Array.from(parent.children);
    return children.find((child) => child.localName === localName) ?? null;
  }

  getChildElements(parent: Element, localName: string): Element[] {
    const children = Array.from(parent.children);
    return children.filter((child) => child.localName === localName);
  }

  private parseResponse(xml: string, operation: string): Element {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const body = this.getSoapBody(doc);

    const responseName = `${operation}Response`;
    const response = this.getChildElement(body, responseName) ?? this.getChildElement(body, 'ErrorResponse');

    if (!response) {
      throw new Error('Invalid SOAP response');
    }

    return response;
  }

  private getSoapBody(doc: Document): Element {
    const body = doc.getElementsByTagNameNS('*', 'Body')[0];
    if (!body) {
      throw new Error('Missing SOAP body');
    }
    return body as Element;
  }

  private buildEnvelope(operation: string, bodyXml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wp="http://watchparty/soap">` +
      `<soap:Body>` +
      `<wp:${operation}>${bodyXml}</wp:${operation}>` +
      `</soap:Body>` +
      `</soap:Envelope>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private resolveEndpoint(): string {
    try {
      const win = window as any;
      const override =
        (typeof win.__WATCHPARTY_API_BASE_URL === 'string' && win.__WATCHPARTY_API_BASE_URL.trim()) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('WATCHPARTY_API_BASE_URL')?.trim()) ||
        '';

      if (override) {
        const trimmed = override.replace(/\/+$/, '');
        return trimmed.endsWith('/soap') ? trimmed : `${trimmed}/soap`;
      }

      const { protocol, host } = window.location;
      return `${protocol}//${host}/soap`;
    } catch {
      return `${window.location.protocol}//${window.location.host}/soap`;
    }
  }
}
