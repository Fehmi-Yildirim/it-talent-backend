import {
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

const BLOCK_NODES = new Set([
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'blockquote',
    'horizontalRule',
]);

const INLINE_NODES = new Set(['text', 'hardBreak']);

const ALLOWED_MARKS = new Set([
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
    'link',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

function hasOnlyKeys(
    value: Record<string, unknown>,
    allowed: string[],
): boolean {
    return Object.keys(value).every((key) => allowed.includes(key));
}

function isSafeHref(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0) {
        return false;
    }

    const href = value.trim();

    if (!href || /\s/.test(href)) {
        return false;
    }

    if (/^https?:\/\//i.test(href)) {
        try {
            const url = new URL(href);
            return Boolean(url.hostname);
        } catch {
            return false;
        }
    }

    if (/^mailto:/i.test(href)) {
        return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href);
    }

    if (href.startsWith('/') && !href.startsWith('//')) {
        return true;
    }

    return href.startsWith('#');
}

function isValidMark(mark: unknown): boolean {
    if (!isRecord(mark) || typeof mark.type !== 'string') {
        return false;
    }

    if (!ALLOWED_MARKS.has(mark.type)) {
        return false;
    }

    if (mark.type === 'link') {
        if (
            !hasOnlyKeys(mark, ['type', 'attrs']) ||
            !isRecord(mark.attrs) ||
            !hasOnlyKeys(mark.attrs, ['href', 'target', 'rel', 'class']) ||
            !isSafeHref(mark.attrs.href)
        ) {
            return false;
        }

        if (
            mark.attrs.target !== undefined &&
            !['_blank', '_self'].includes(mark.attrs.target as string)
        ) {
            return false;
        }

        return (
            (mark.attrs.rel === undefined ||
                typeof mark.attrs.rel === 'string') &&
            (mark.attrs.class === undefined ||
                typeof mark.attrs.class === 'string')
        );
    }

    return hasOnlyKeys(mark, ['type']);
}

function isInlineContent(content: unknown): boolean {
    return (
        Array.isArray(content) &&
        content.every(
            (node) =>
                isValidNode(node) &&
                isRecord(node) &&
                INLINE_NODES.has(node.type as string),
        )
    );
}

function isBlockContent(content: unknown): boolean {
    return (
        Array.isArray(content) &&
        content.every(
            (node) =>
                isValidNode(node) &&
                isRecord(node) &&
                BLOCK_NODES.has(node.type as string),
        )
    );
}

function isValidNode(node: unknown): boolean {
    if (!isRecord(node) || typeof node.type !== 'string') {
        return false;
    }

    switch (node.type) {
        case 'doc':
            return (
                hasOnlyKeys(node, ['type', 'content']) &&
                isBlockContent(node.content)
            );

        case 'paragraph':
            return (
                hasOnlyKeys(node, ['type', 'content']) &&
                (node.content === undefined || isInlineContent(node.content))
            );

        case 'heading':
            return (
                hasOnlyKeys(node, ['type', 'attrs', 'content']) &&
                isRecord(node.attrs) &&
                hasOnlyKeys(node.attrs, ['level']) &&
                [2, 3].includes(node.attrs.level as number) &&
                isInlineContent(node.content)
            );

        case 'text':
            return (
                hasOnlyKeys(node, ['type', 'text', 'marks']) &&
                typeof node.text === 'string' &&
                node.text.length > 0 &&
                (node.marks === undefined ||
                    (Array.isArray(node.marks) &&
                        node.marks.every(isValidMark)))
            );

        case 'hardBreak':
        case 'horizontalRule':
            return hasOnlyKeys(node, ['type']);

        case 'bulletList':
        case 'orderedList':
            return (
                hasOnlyKeys(node, ['type', 'content']) &&
                Array.isArray(node.content) &&
                node.content.length > 0 &&
                node.content.every(
                    (child) =>
                        isValidNode(child) &&
                        isRecord(child) &&
                        child.type === 'listItem',
                )
            );

        case 'listItem':
            return (
                hasOnlyKeys(node, ['type', 'content']) &&
                Array.isArray(node.content) &&
                node.content.length > 0 &&
                isRecord(node.content[0]) &&
                node.content[0].type === 'paragraph' &&
                node.content.every(
                    (child) =>
                        isValidNode(child) &&
                        isRecord(child) &&
                        BLOCK_NODES.has(child.type as string) &&
                        child.type !== 'horizontalRule',
                )
            );

        case 'blockquote':
            return (
                hasOnlyKeys(node, ['type', 'content']) &&
                isBlockContent(node.content)
            );

        default:
            return false;
    }
}

export function isTiptapJson(value: unknown): boolean {
    return (
        isRecord(value) &&
        value.type === 'doc' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        isBlockContent(value.content)
    );
}

export function IsTiptapJson(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isTiptapJson',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: (value: unknown) => isTiptapJson(value),
                defaultMessage: () =>
                    'Content must be valid Tiptap JSON with supported nodes and marks',
            },
        });
    };
}
