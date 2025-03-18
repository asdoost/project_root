import os
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

CORPUS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus')

def search_corpus(query, page=1, per_page=5):
    results = []
    for filename in os.listdir(CORPUS_DIR):
        if filename.endswith('.txt'):
            with open(os.path.join(CORPUS_DIR, filename), 'r') as file:
                content = file.read()
                # Simple search for the query in the content
                positions = [pos for pos in range(len(content)) if content.startswith(query, pos)]
                for pos in positions:
                    left_context = content[max(0, pos - 30):pos]
                    right_context = content[pos + len(query):pos + len(query) + 30]
                    results.append({
                        "left_context": left_context,
                        "kwic": query,
                        "right_context": right_context,
                        "source": filename
                    })
    # Paginate results
    total_results = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_results = results[start:end]
    return paginated_results, total_results

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search')
def search():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    per_page = 5
    results, total_results = search_corpus(query, page, per_page)
    return jsonify(results=results, total_results=total_results, page=page, per_page=per_page)

if __name__ == '__main__':
    app.run(debug=True)