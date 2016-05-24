import { localeConversions } from './Constants';

declare var CSL;

interface State {
    citations: {
        [itemID: string]: CSL.Data;
    };
}

export class CSLProcessor {

    /**
     * This object converts the locale names in wordpress (keys) to the locales
     *   in CSL (values). If CSL doesn't have a locale for a given WordPress locale,
     *   then false is used (which will default to en-US).
     */
    private locales = localeConversions;
    private locale: string;

    public style: string;
    public state: State;
    public citeproc: Citeproc.Processor;

    /**
     * @param locale Locale string passed in from WordPress.
     * @param style  Selected citation style (chosen on options page).
     */
    constructor(locale: string, style: string, state, citationsByIndex: Citeproc.Citation[]) {
        this.state = {
            citations: state,
        };
        console.log(this.state);
        this.style = style === '' ? 'american-medical-association' : style;
        this.locale = locale;

        this.init(this.style)
        .then(data => {
            if (data instanceof Error) {
                console.error(data.message);
                return;
            }
            this.citeproc = new CSL.Engine(data.sys, data.style);
        })
        .then(() => {
            this.citeproc.rebuildProcessorState(citationsByIndex);
        });
    }

    /**
     * Called exclusively from the `init` method to generate the `sys` object
     *   required by the CSL.Engine.
     * @param locale The locale string from this.locales (handled in constructor)
     * @return Promise that resolves either to a Citeproc.SystemObj or Error,
     *   depending on the response from the network request.
     */
    private generateSys(locale: string): Promise<Citeproc.SystemObj|Error> {
        return new Promise((resolve, reject) => {
            const req = new XMLHttpRequest();
            const cslLocale = !this.locales[locale] ? 'en-US' : this.locales[locale];
            req.onreadystatechange = () => {
                if (req.readyState === 4) {
                    if (req.status !== 200) reject(new Error(req.responseText));
                    resolve({
                        retrieveLocale: (lang: string) => req.responseText,
                        retrieveItem: (id: string|number) => this.state.citations[id],
                    });
                }
            };
            req.open('GET', `https://raw.githubusercontent.com/citation-style-language/locales/8c976408d3cb287d0cecb29f97752ec3a28db9e5/locales-${cslLocale}.xml`);
            req.send(null);
        })
        .catch(e => e);
    }

    /**
     * Called exclusively from the `init` method to get the CSL style file over
     *   the air from the Github repo.
     * @param style CSL style filename
     * @return Promise that resolves to a string of CSL XML or an Error, depending
     *   on the response from the network request.
     */
    private getCSLStyle(style: string): Promise<string|Error> {
        return new Promise((resolve, reject) => {
            const req = new XMLHttpRequest();
            req.open('GET', `https://raw.githubusercontent.com/citation-style-language/styles/master/${style}.csl`);
            req.onreadystatechange = () => {
                if (req.readyState === 4) {
                    if (req.status !== 200) reject(new Error(req.responseText));
                    resolve(req.responseText);
                }
            };
            req.send(null);
        })
        .catch(e => e);
    }

    /**
     * Instantiates a new CSL.Engine (either when initially constructed or when
     *   the user changes his/her selected citation style)
     * @param styleID CSL style filename.
     * @return Promise that resolves to either an object containing the style XML
     *   and the `sys` object, or an Error depending on the responses from the
     *   network.
     */
    init(styleID: string): Promise<{style: string, sys: Citeproc.SystemObj}|Error> {
        this.style = styleID;
        const p1 = this.getCSLStyle(styleID);
        const p2 = this.generateSys(this.locale);
        return Promise.all(
            [p1, p2]
        )
        .then(data => {
            const [style, sys] = data;
            if (style instanceof Error) return style;
            if (sys instanceof Error) return sys;
            return {style, sys};
        })
        .catch(e => e);
    }

    /**
     * Updates the Citeproc object and the local state with new citation data.
     * @param citations Array of CSL.Data.
     */
    consumeCitations(citations: CSL.Data[]): {[itemID: string]: CSL.Data} {
        const newCitations = {};
        citations.forEach(c => {
            newCitations[c.id] = c;
        });
        this.state.citations = Object.assign({}, this.state.citations, newCitations);
        return this.state.citations;
    }

    /**
     * Either retrieves a Citeproc.CitationByIndexSingle object from the citeproc
     *   registry or, if it doesn't exist in the registry, transforms the CSL.Data[]
     *   param into that shape.
     * @param currentIndex The current inline-citation's index.
     * @param csl Fallback CSL.Data[].
     * @return Citeproc.CitationByIndexSingle for the current inline citation.
     */
    prepareInlineCitationData(currentIndex: number, csl: CSL.Data[]): Citeproc.Citation {
        const payload = {
            citationItems: [],
            properties: { noteIndex: 0 },
        };
        csl.forEach((c) => payload.citationItems.push({id: c.id}));
        return payload;
    }

}
