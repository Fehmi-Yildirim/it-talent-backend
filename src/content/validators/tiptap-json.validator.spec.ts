import { isTiptapJson } from './tiptap-json.validator';

describe('isTiptapJson', () => {
    it('accepts valid Tiptap JSON', () => {
        const content = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Hello world',
                            marks: [{ type: 'bold' }],
                        },
                    ],
                },
            ],
        };

        expect(isTiptapJson(content)).toBe(true);
    });

    it('accepts headings H2 and H3', () => {
        for (const level of [2, 3]) {
            expect(
                isTiptapJson({
                    type: 'doc',
                    content: [
                        {
                            type: 'heading',
                            attrs: { level },
                            content: [{ type: 'text', text: 'Heading' }],
                        },
                    ],
                }),
            ).toBe(true);
        }
    });

    it('rejects unsupported heading levels', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 1 },
                        content: [{ type: 'text', text: 'Heading' }],
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects unsupported node types', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [{ type: 'image' }],
            }),
        ).toBe(false);
    });

    it('rejects unsupported marks', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Hello',
                                marks: [{ type: 'highlight' }],
                            },
                        ],
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects unsafe links', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Click here',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: { href: 'javascript:alert(1)' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        ).toBe(false);
    });

    it('accepts safe HTTPS links', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Visit website',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: { href: 'https://example.com' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        ).toBe(true);
    });

    it('rejects values that are not documents', () => {
        expect(isTiptapJson(null)).toBe(false);
        expect(isTiptapJson('Hello world')).toBe(false);
        expect(isTiptapJson({ type: 'paragraph' })).toBe(false);
    });


    it('rejects unexpected properties on the document', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [],
                unexpected: true,
            }),
        ).toBe(false);
    });

    it('rejects unexpected properties on nodes', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [],
                        unexpected: true,
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects text directly inside the document', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'text',
                        text: 'Invalid structure',
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects invalid list structures', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'paragraph',
                                content: [],
                            },
                        ],
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects protocol-relative links', () => {
        expect(
            isTiptapJson({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'Unsafe link',
                                marks: [
                                    {
                                        type: 'link',
                                        attrs: {
                                            href: '//evil.example',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        ).toBe(false);
    });
});
