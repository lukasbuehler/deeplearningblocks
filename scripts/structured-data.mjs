export function structuredData(site) {
  if (!site.indexable) return '';

  const home = `${site.origin}/`;
  const websiteId = `${home}#website`;
  const appId = `${home}#playground`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: home,
        name: 'Deep Learning Blocks',
        inLanguage: 'en',
        about: { '@id': appId },
      },
      {
        '@type': 'WebApplication',
        '@id': appId,
        url: `${home}play`,
        name: 'Deep Learning Blocks',
        description:
          'An interactive playground for building neural networks with blocks and optionally training them on handwritten digits and clothing images.',
        applicationCategory: 'EducationalApplication',
        browserRequirements: 'Requires JavaScript and a modern web browser.',
        inLanguage: 'en',
        isAccessibleForFree: true,
        isPartOf: { '@id': websiteId },
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>\n`;
}
