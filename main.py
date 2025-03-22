import os
import re
import json
import pandas as pd
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

CORPUS_DIR = '/home/asdoost/Scripts/projects/project_root/corpus/sample_corpus.ods'#os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus')
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

def read_from_ods(path):
    """
    Reads ODS file and reconstructs original nested list structure.
    
    Returns:
    list of lists of tuples - [[(token, tag, lemma), ...], ...]
    """
    df = pd.read_excel(path, engine='odf').fillna(pd.NA)
    result = []
    current_sublist = []
    
    for _, row in df.iterrows():
        if all(pd.isna(row)):
            if current_sublist:
                result.append(current_sublist)
                current_sublist = []
        else:
            current_sublist.append(tuple(row))
    
    if current_sublist:  # Add last sublist if exists
        result.append(current_sublist)
        
    return result

def search_corpus(
    target_word: str,
    context_window: int,
    match_type: str
) -> tuple:
    """
    Searches a corpus for occurrences of a target word within a specified context window.

    Parameters
    ----------
    target_word : str
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

    corpus = read_from_ods(CORPUS_DIR)
    target_word = target_word.lower()
    results = []
    joined_setences = {}
    padding_tuple = ('#', '#', '#')
    
    # Preprocess once per corpus entry
    for sent_idx, sentence in enumerate(corpus):
        # Create a preprocessed list of tuples with normalized lemma
        processed_sent = [
            (tpl[0].lower(), tpl[1], DIACRITIC_PATTERN.sub('', tpl[2]).lower())
            for tpl in sentence
        ]
        
        # Find matches using list comprehension
        matches = [
            (i, token, lemma) for i, (token, _, lemma) in enumerate(processed_sent)
            if (match_type == 'token' and token == target_word) or 
               (match_type == 'lemma' and lemma == target_word)
        ]
        
        for i, _, _ in matches:
            # Calculate window boundaries
            start = max(0, i - context_window)
            end = min(len(sentence), i + context_window + 1)
            
            # Calculate required padding using clearer variable names
            left_pad = max(0, context_window - (i - start))
            right_pad = max(0, context_window - (end - i - 1))
            
            # Build context with padding
            context = (
                [padding_tuple] * left_pad +
                sentence[start:end] +
                [padding_tuple] * right_pad
            )
            
            # Extract tokens using list comprehension
            context_tokens = [t for t, _, _ in context]
            
            results.append({
                'context': context_tokens,
                'sentence_index': sent_idx,
                # f'{sent_idx}': ' '.join(['\n' if t=='؎' else t for t, _, _ in sentence])
            })
            joined_setences[sent_idx] = ' '.join(['\n' if t=='؎' else t for t, _, _ in sentence])
    results.sort(key=lambda x: x['context'][context_window])
    
    return results, joined_setences


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search')
def search():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    context_window = int(request.args.get('window', 5))
    match_type = request.args.get('match_type', 'token')
    per_page = 10
    results, joined_setences = search_corpus(query, context_window, match_type)
    total_frequency = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_results = results[start:end]
    return jsonify(
        results=paginated_results, 
        total_frequency=total_frequency, 
        page=page, 
        per_page=per_page,
        joined_setences=joined_setences
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

if __name__ == '__main__':
    app.run(debug=True)
