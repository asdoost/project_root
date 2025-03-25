import os
import re
import json
from pickle5 import pickle
from termcolor import colored
from flask import Flask, render_template, request, jsonify
import nltk
from nltk.tokenize import word_tokenize
from nltk.tag import pos_tag

app = Flask(__name__)

CORPUS_DIR = 'corpus/whole_corpus.pkl'
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

def file_handling(path, mod="rb", data=""):

    with open(path, mod) as handle:
        if mod=="rb":
            data = pickle.load(handle)
            return data
        
        elif mod=="wb":
            pickle.dump(data, handle, protocol=pickle.HIGHEST_PROTOCOL)
            print(colored(f"The file has been saved as\n", "yellow") + colored(path, "green"))

def edit_errors(token):
    if re.search(r'^.+\[ADD\]$', token):
        return re.sub(r'^(.+)\[ADD\]$', r'\1', token)
    elif re.search(r'^.+\[.+\]$', token):
        return re.sub(r'^.+\[(.+)\]$', r'\1', token)
    else:
        raise Exception("The token doesn't have an error structure")

def wildcard_search(pattern, case_insensitive=False, exact_match=True):
    """
    Search for wildcard patterns in a list of strings.
    
    Args:
        pattern (str): Wildcard pattern (e.g., "a*b", "file?.txt").
        case_insensitive (bool): If True, perform case-insensitive search.
        exact_match (bool): If True, match entire strings; else, find substrings.

    Returns:
        regex pattern
    """
    # Convert wildcards to regex
    regex_pattern = ""
    for char in pattern:
        if char == "*":
            regex_pattern += ".*"
        elif char == "?":
            regex_pattern += "."
        else:
            regex_pattern += re.escape(char)  # Escape special regex characters

    # Add anchors for exact matches
    if exact_match:
        regex_pattern = f"^{regex_pattern}$"

    # Compile regex with flags
    flags = re.IGNORECASE if case_insensitive else 0
    regex = re.compile(regex_pattern, flags)

    # Return matches
    return regex

def search_corpus(
    query_string: str,
    context_window: int,
    match_type: str,
    explicit: str,
    remove_pnc: bool,
    edit_error: bool,
    remove_emoji: bool,
    ) -> tuple:
    """
    Searches a corpus for occurrences of a target word within a specified context window.

    Parameters
    ----------
    query_string : str
        The word to search for in the corpus.
    context_window : int
        The number of words to include in the context on each side of the target word.
    match_type : str
        Specifies whether to match against 'token' or 'lemma'.

    Returns
    -------
    tuple
        A tuple containing a list of dictionaries with context information and the total count of matches.
        Each dictionary includes 'context' (a list of tokens) and 'sentence_index'.

    Notes
    -----
    - The function preprocesses the corpus by removing diacritics from lemmas.
    - It performs case-insensitive matching.
    """

    # Precompile regex pattern for diacritic removal using code points
    DIACRITIC_PATTERN = re.compile(u'[\u064E\u064F\u0650\u064B\u064C\u064D\u0651\u0652]')

    corpus = file_handling(CORPUS_DIR)
    results = []
    joined_sentences = {}
    token_dic = {}
    tag_dic = {}
    lemma_dic = {}
    padding_tuple = ('#', '#', '#')
    corpus_length = 0
    query_pattern = wildcard_search(query_string)
    
    # Preprocess once per corpus entry
    for sent_idx, sentence in enumerate(corpus):

        corpus_length += len(sentence)

        if explicit == 'exclude' and any(g[-2] == 'T' for _, g, _ in sentence):
            continue

        # Create a preprocessed list of tuples with normalized lemma
        processed_sent = []
        for token, tag, lemma in sentence:
            if (edit_error and lemma == '[DEL]') or (remove_pnc and lemma == '[PNC]') or (remove_emoji and lemma == '[EMJ]'):
                continue
            if edit_error and tag[-1] == 'E':
                token = edit_errors(token)
            if explicit == 'mask' and tag[-2] == 'T':
                token = token[0] + (len(token) - 2) * '*' + token[-1]
            
            processed_sent.append((token.lower(), tag, DIACRITIC_PATTERN.sub('', lemma).lower()))
        
        for idx, (token, tag, lemma) in enumerate(processed_sent):
            
            if (match_type == 'token' and query_pattern.search(token)) or (match_type == 'lemma' and query_pattern.search(lemma)):
                
                token_dic[token] = token_dic.get(token, 0) + 1
                tag_dic[tag[0]] = tag_dic.get(tag[0], 0) + 1
                lemma_dic[lemma] = lemma_dic.get(lemma, 0) + 1
                
                # Calculate window boundaries
                start = max(0, idx - context_window)
                end = min(len(processed_sent), idx + context_window + 1)
                
                # Calculate required padding using clearer variable names
                left_pad = max(0, context_window - (idx - start))
                right_pad = max(0, context_window - (end - idx - 1))
                
                # Build context with padding
                context = ([padding_tuple] * left_pad + processed_sent[start:end] + [padding_tuple] * right_pad)
                
                # Extract tokens using list comprehension
                output = [t for t, _, _ in context]
                
                results.append({
                    'context': output,
                    'sentence_index': sent_idx,
                    'joined_sentences': ' '.join(['\n' if t == '؎' else t for t, _, _ in sentence])
                })

    results.sort(key=lambda x: x['context'][context_window])
    
    return results, corpus_length, token_dic, tag_dic, lemma_dic

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search')
def search():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    context_window = int(request.args.get('context_window', 5))
    match_type = request.args.get('match_type', 'token')
    explicit = request.args.get('explicit', 'exclude')
    edit_error = int(request.args.get('error_editing', True))
    remove_pnc = int(request.args.get('remove_punctuations', True))
    remove_emoji = int(request.args.get('remove_emojis', False))
    
    results, corpus_length, token_dic, tag_dic, lemma_dic = search_corpus(
        query, context_window, match_type, explicit, remove_pnc, edit_error, remove_emoji)
    
    per_page = 10
    total_frequency = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_results = results[start:end]

    return jsonify(
        results=paginated_results, 
        total_frequency=total_frequency, 
        page=page, 
        per_page=per_page,
        corpus_length=corpus_length,
        token_dic=token_dic, 
        tag_dic=tag_dic, 
        lemma_dic=lemma_dic
    )

@app.route('/words')
def words():
    try:
        with open(os.path.join(STATIC_DIR, 'autocomplete_words.json'), 'r') as file:
            words = json.load(file)
        return jsonify(words)
    except Exception as e:
        print(f"Error loading words: {e}")
        return jsonify([]), 500

@app.route('/pos_tag')
def pos_tag():
    return render_template('pos_tag.html')

@app.route('/tag_text', methods=['POST'])
def tag_text():
    data = request.get_json()
    text = data['text']
    tokens = word_tokenize(text)
    tagged_tokens = pos_tag(tokens)
    tagged_text = ' '.join([f"{word}/{tag}" for word, tag in tagged_tokens])
    return jsonify(tagged_text=tagged_text)

@app.route('/corpus_selection')
def corpus_selection():
    return render_template('corpus_selection.html')

@app.route('/concordance')
def concordance():
    return render_template('concordance.html')

@app.route('/word_lists')
def word_lists():
    return render_template('word_lists.html')

@app.route('/statistics')
def statistics():
    return render_template('statistics.html')

if __name__ == '__main__':
    app.run(debug=True)
