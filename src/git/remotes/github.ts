'use strict';
import { Range } from 'vscode';
import { RemoteProvider } from './provider';
import { AutolinkReference } from '../../config';
import { DynamicAutolinkReference } from '../../annotations/autolinks';
import { Container } from '../../container';
import { PullRequest } from '../models/pullRequest';

const issueEnricher3rdParyRegex = /\b(\w+\\?-?\w+(?!\\?-)\/\w+\\?-?\w+(?!\\?-))\\?#([0-9]+)\b/g;

export class GitHubRemote extends RemoteProvider {
	constructor(domain: string, path: string, protocol?: string, name?: string, custom: boolean = false) {
		super(domain, path, protocol, name, custom);
	}

	private _autolinks: (AutolinkReference | DynamicAutolinkReference)[] | undefined;
	get autolinks(): (AutolinkReference | DynamicAutolinkReference)[] {
		if (this._autolinks === undefined) {
			this._autolinks = [
				{
					prefix: '#',
					url: `${this.baseUrl}/issues/<num>`,
					title: 'Open Issue #<num>'
				},
				{
					prefix: 'gh-',
					url: `${this.baseUrl}/issues/<num>`,
					title: 'Open Issue #<num>',
					ignoreCase: true
				},
				{
					linkify: (text: string) =>
						text.replace(
							issueEnricher3rdParyRegex,
							`[$&](${this.protocol}://${this.domain}/$1/issues/$2 "Open Issue #$2 from $1")`
						)
				}
			];
		}
		return this._autolinks;
	}

	get icon() {
		return 'github';
	}

	get name() {
		return this.formatName('GitHub');
	}

	private _prsByCommit = new Map<string, Promise<PullRequest | undefined>>();
	async getPullRequestForCommit(ref: string): Promise<PullRequest | undefined> {
		let pr = this._prsByCommit.get(ref);
		if (pr === undefined) {
			const [owner, repo] = this.splitPath();
			pr = (await Container.github)?.getPullRequestForCommit(owner, repo, ref);
			if (pr != null) {
				this._prsByCommit.set(ref, pr);
			}
		}
		return pr;
	}

	protected getUrlForBranches(): string {
		return `${this.baseUrl}/branches`;
	}

	protected getUrlForBranch(branch: string): string {
		return `${this.baseUrl}/commits/${branch}`;
	}

	protected getUrlForCommit(sha: string): string {
		return `${this.baseUrl}/commit/${sha}`;
	}

	protected getUrlForFile(fileName: string, branch?: string, sha?: string, range?: Range): string {
		let line;
		if (range) {
			if (range.start.line === range.end.line) {
				line = `#L${range.start.line}`;
			} else {
				line = `#L${range.start.line}-L${range.end.line}`;
			}
		} else {
			line = '';
		}

		if (sha) return `${this.baseUrl}/blob/${sha}/${fileName}${line}`;
		if (branch) return `${this.baseUrl}/blob/${branch}/${fileName}${line}`;
		return `${this.baseUrl}?path=${fileName}${line}`;
	}
}
