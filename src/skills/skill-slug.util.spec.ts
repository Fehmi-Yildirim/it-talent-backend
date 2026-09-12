import { generateSkillSlug } from './skill-slug.util';

describe('generateSkillSlug', () => {
    it.each([
        ['React', 'react'],
        ['React Native', 'react-native'],
        ['Machine Learning', 'machine-learning'],
        ['Node.js', 'node-js'],
        ['Next.js', 'next-js'],
        ['C#', 'c'],
        ['Full-stack development', 'full-stack-development'],
    ])('generates "%s" as "%s"', (name, expected) => {
        expect(generateSkillSlug(name)).toBe(expected);
    });

    it('converts accented characters to their base characters', () => {
        expect(generateSkillSlug('Développement Web')).toBe(
            'developpement-web',
        );
    });

    it('replaces special characters with hyphens', () => {
        expect(generateSkillSlug('C++ Programming')).toBe(
            'c-programming',
        );
    });

    it('collapses repeated separators', () => {
        expect(generateSkillSlug('Full---Stack   Development')).toBe(
            'full-stack-development',
        );
    });

    it('trims leading and trailing separators', () => {
        expect(generateSkillSlug('  React Native  ')).toBe('react-native');
    });

    it('converts uppercase characters to lowercase', () => {
        expect(generateSkillSlug('TYPESCRIPT')).toBe('typescript');
    });
});