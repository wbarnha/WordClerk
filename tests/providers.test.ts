import { parseCaseCitation, extractCaseCitations } from '../src/taskpane/providers/citationParser';
import { CitationProviderRegistry } from '../src/taskpane/providers/registry';
import { CourtListenerProvider } from '../src/taskpane/providers/courtListenerProvider';
import { LexisNexisProvider } from '../src/taskpane/providers/lexisNexisProvider';
import { UsptoPatentCenterProvider } from '../src/taskpane/providers/usptoPatentCenterProvider';
import { CitationProvider } from '../src/taskpane/providers/types';

const EXAMPLE_CITATION = 'Norfolk & W. Ry. Co. v. Liepelt, 444 U.S. 490 (U.S.Ill., 1980)';

describe('parseCaseCitation', () => {
  test('parses case name, volume, reporter, page, court, and year', () => {
    expect(parseCaseCitation(EXAMPLE_CITATION)).toEqual({
      raw: EXAMPLE_CITATION,
      caseName: 'Norfolk & W. Ry. Co. v. Liepelt',
      volume: '444',
      reporter: 'U.S.',
      page: '490',
      court: 'U.S.Ill.',
      year: '1980',
    });
  });

  test('returns null for text that is not citation-shaped', () => {
    expect(parseCaseCitation('Just some regular text.')).toBeNull();
    expect(parseCaseCitation('')).toBeNull();
  });
});

describe('extractCaseCitations', () => {
  test('finds a full citation embedded in surrounding prose', () => {
    const text = `The court's holding in ${EXAMPLE_CITATION} affects the collateral source rule.`;
    expect(extractCaseCitations(text)).toContain(EXAMPLE_CITATION);
  });

  test('strips a leading Bluebook introductory signal from the match', () => {
    // "Accord" is itself capitalized-word-shaped, so unlike lowercase prose it isn't rejected by the
    // case-name token pattern on its own -- exercising the explicit signal-stripping step.
    const text = `Accord ${EXAMPLE_CITATION}.`;
    const results = extractCaseCitations(text);
    expect(results).toContain(EXAMPLE_CITATION);
    expect(results.some((r) => r.startsWith('Accord'))).toBe(false);
  });

  test('returns an empty array when no citation-shaped text is present', () => {
    expect(extractCaseCitations('Nothing to see here.')).toEqual([]);
  });
});

describe('CitationProviderRegistry', () => {
  test('registers and retrieves providers by id', () => {
    const registry = new CitationProviderRegistry();
    const provider = new CourtListenerProvider();
    registry.register(provider);

    expect(registry.get('courtlistener')).toBe(provider);
    expect(registry.list()).toContain(provider);
  });

  test('returns undefined for an unknown id', () => {
    const registry = new CitationProviderRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });

  test('unregister removes a provider', () => {
    const registry = new CitationProviderRegistry();
    const provider = new CourtListenerProvider();
    registry.register(provider);
    registry.unregister(provider.id);
    expect(registry.get(provider.id)).toBeUndefined();
  });
});

describe('CourtListenerProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('returns a hyperlink match when the API resolves exactly one case', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          citation: '444 U.S. 490',
          status: 200,
          clusters: [
            {
              case_name: 'Norfolk & Western Railway Co. v. Liepelt',
              absolute_url: '/opinion/108713/norfolk-western-railway-co-v-liepelt/',
            },
          ],
        },
      ],
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new CourtListenerProvider();
    const match = await provider.lookupCitation({ raw: EXAMPLE_CITATION });

    expect(match).toEqual({
      url: 'https://www.courtlistener.com/opinion/108713/norfolk-western-railway-co-v-liepelt/',
      caseName: 'Norfolk & Western Railway Co. v. Liepelt',
      citation: '444 U.S. 490',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.courtlistener.com/api/rest/v4/citation-lookup/',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('moves on (returns null) when the citation is not found', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { citation: '1 U.S. 200', status: 404, clusters: [], error_message: "Citation not found: '1 U.S. 200'" },
      ],
    }) as unknown as typeof fetch;

    const provider = new CourtListenerProvider();
    await expect(provider.lookupCitation({ raw: '1 U.S. 200' })).resolves.toBeNull();
  });

  test('moves on (returns null) instead of throwing on a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const provider = new CourtListenerProvider();
    await expect(provider.lookupCitation({ raw: EXAMPLE_CITATION })).resolves.toBeNull();
  });

  test('moves on (returns null) instead of throwing on a non-OK HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const provider = new CourtListenerProvider();
    await expect(provider.lookupCitation({ raw: EXAMPLE_CITATION })).resolves.toBeNull();
  });

  test('sends the API token in the Authorization header once connected', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new CourtListenerProvider();
    await provider.authenticate({ apiToken: 'secret-token' });
    await provider.lookupCitation({ raw: EXAMPLE_CITATION });

    const lookupCallOptions = mockFetch.mock.calls[1][1];
    expect(lookupCallOptions.headers.Authorization).toBe('Token secret-token');
  });

  test('is usable without any credentials', () => {
    expect(new CourtListenerProvider().isAuthenticated()).toBe(true);
  });
});

describe('EnterpriseCitationProvider (LexisNexis as representative)', () => {
  test('rejects authenticate() when required fields are missing', async () => {
    const provider = new LexisNexisProvider();
    await expect(provider.authenticate({ apiBaseUrl: '', clientId: '', clientSecret: '' })).rejects.toThrow(
      /Missing required field/
    );
  });

  test('lookupCitation returns null (move on) when not authenticated, without throwing', async () => {
    const provider: CitationProvider = new LexisNexisProvider();
    await expect(provider.lookupCitation({ raw: EXAMPLE_CITATION })).resolves.toBeNull();
  });

  test('is not authenticated until authenticate() succeeds', () => {
    expect(new LexisNexisProvider().isAuthenticated()).toBe(false);
  });
});

describe('UsptoPatentCenterProvider (TODO placeholder)', () => {
  test('is registered but always defers (returns null)', async () => {
    const provider = new UsptoPatentCenterProvider();
    await expect(provider.lookupCitation({ raw: EXAMPLE_CITATION })).resolves.toBeNull();
  });

  test('authenticate() rejects since the integration is not implemented yet', async () => {
    await expect(new UsptoPatentCenterProvider().authenticate({})).rejects.toThrow(/not implemented/);
  });
});
