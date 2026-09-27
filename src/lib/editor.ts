import DOMPurify from 'dompurify';

// Keep document formatting, never page layout, scripts, or externally loaded CSS.
const styleProperties = [
	'color',
	'background-color',
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'text-decoration',
	'text-align',
	'line-height',
	'white-space'
];

export function cleanHTML(html: string, matchStyle = false): string {
	const fragment = DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'p',
			'div',
			'span',
			'br',
			'b',
			'strong',
			'i',
			'em',
			'u',
			's',
			'del',
			'a',
			'ul',
			'ol',
			'li',
			'blockquote',
			'pre',
			'code',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'hr',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'sub',
			'sup',
			'img'
		],
		ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'colspan', 'rowspan', 'start'],
		ALLOW_DATA_ATTR: false,
		ALLOW_ARIA_ATTR: false,
		RETURN_DOM_FRAGMENT: true
	});
	for (const element of fragment.querySelectorAll<HTMLElement>('*')) {
		const original = element.style;
		const styles = document.createElement('span').style;
		if (!matchStyle) {
			for (const property of styleProperties) {
				const value = original.getPropertyValue(property);
				if (value && !/url\s*\(|var\s*\(|expression|\\/i.test(value))
					styles.setProperty(property, value);
			}
		}
		element.removeAttribute('style');
		if (styles.cssText) element.setAttribute('style', styles.cssText);
		if (element.tagName === 'A') {
			const href = element.getAttribute('href') ?? '';
			if (!/^(https?:\/\/|mailto:|\/files\/|#)/i.test(href)) element.removeAttribute('href');
			element.setAttribute('rel', 'noopener noreferrer');
		}
		if (element.tagName === 'IMG') {
			const src = element.getAttribute('src') ?? '';
			if (!/^(https?:\/\/|\/files\/)/i.test(src)) element.remove();
		}
	}
	const container = document.createElement('div');
	container.appendChild(fragment);
	return container.innerHTML;
}

export function textHTML(text: string): string {
	const span = document.createElement('span');
	span.textContent = text;
	return span.innerHTML.replace(/\r\n?|\n/g, '<br>');
}
