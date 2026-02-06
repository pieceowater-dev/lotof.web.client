export default defineNuxtPlugin(() => {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'lota',
          alternateName: 'LOTA',
          url: 'https://lota.tools',
          logo: 'https://lota.tools/apple-touch-icon.png',
          description: 'Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно.',
          sameAs: [],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            availableLanguage: ['Russian', 'English']
          },
          inLanguage: ['ru-RU', 'en-US']
        })
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'lota',
          alternateName: 'LOTA',
          url: 'https://lota.tools',
          inLanguage: 'ru-RU',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://lota.tools/search?q={search_term_string}'
            },
            'query-input': 'required name=search_term_string'
          }
        })
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'lota',
          alternateName: 'LOTA - Платформа автоматизации бизнеса',
          url: 'https://lota.tools',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'All',
          inLanguage: ['ru-RU', 'en-US'],
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'RUB'
          },
          browserRequirements: 'Requires JavaScript. Requires HTML5.',
          description: 'Платформа автоматизации для современного бизнеса. Управляйте посещаемостью, трекингом и рабочими процессами эффективно.'
        })
      }
    ]
  })
})
