import json
import os
from flask import Flask, render_template, request, jsonify
import pandas as pd

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

def search_corpus(key_word, window=5):
    corpus = read_from_ods(CORPUS_DIR)

    # Initialize an empty list to store results
    results = []

    for tw in corpus:
        for i, tup in enumerate(tw):
            token, tag, lemma = tup
            if token == key_word.lower():
                # Calculate the start and end indices for the window
                start = max(0, i - window)
                end = min(len(tw), i + window + 1)
                left = 0 if i - start == window else window - (i - start)
                right = 0 if end - i == window else window - (end - i)

                # Extract the words within the window
                context = left*[('#','#','#')] + tw[start:end] + right*[('#','#', '#')]
                context = [t for t,g,l in context]

                # Append the result to the list
                results.append(context)

    return results, len(results)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search')
def search():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    per_page = 5
    results, total_frequency = search_corpus(query)
    total_results = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_results = results[start:end]
    return jsonify(results=paginated_results, total_results=total_results, total_frequency=total_frequency, page=page, per_page=per_page)

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
