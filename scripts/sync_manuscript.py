import re
import os
import shutil

vibecount_dir = "/Users/iyakavets/Documents/Github/VibeCount"
treewriter_dir = "/Users/iyakavets/Documents/Github/TreeWriterGitOverleaf"
paper_dir = os.path.join(treewriter_dir, "model/papers/vibecount")

# --- STEP 1: Update INDEX.md files of empty/leaf sections to kind: unit ---
folders_to_unit = [
    "abstract",
    "discussion",
    "author-contributions",
    "conflicts-of-interest",
    "data-availability",
    "acknowledgements",
    "supplementary-information",
    "tables"
]

for folder in folders_to_unit:
    index_path = os.path.join(paper_dir, folder, "INDEX.md")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Replace kind: section with kind: unit
        content_new = content.replace("kind: section", "kind: unit")
        if content != content_new:
            with open(index_path, "w", encoding="utf-8") as f:
                f.write(content_new)
            print(f"Updated {folder}/INDEX.md to kind: unit")

# --- STEP 2: Delete results/deployment_generalization/p3_envelope ---
p3_dir = os.path.join(paper_dir, "results/deployment_generalization/p3_envelope")
if os.path.exists(p3_dir):
    shutil.rmtree(p3_dir)
    print("Deleted p3_envelope directory")

# Update results/deployment_generalization/INDEX.md
dg_index_path = os.path.join(paper_dir, "results/deployment_generalization/INDEX.md")
if os.path.exists(dg_index_path):
    with open(dg_index_path, "r", encoding="utf-8") as f:
        dg_content = f.read()
    # Remove p3_envelope from child_order
    dg_content_new = re.sub(r"\s+-\s+p3_envelope", "", dg_content)
    if dg_content != dg_content_new:
        with open(dg_index_path, "w", encoding="utf-8") as f:
            f.write(dg_content_new)
        print("Updated results/deployment_generalization/INDEX.md child_order")


# --- STEP 3: LaTeX translation logic ---

def remove_macro(text, macro_name):
    pattern = re.compile(r"\\" + re.escape(macro_name) + r"\{")
    while True:
        match = pattern.search(text)
        if not match:
            break
        start_idx = match.start()
        brace_count = 1
        curr_idx = start_idx + len(macro_name) + 2  # '\\' + name + '{'
        while brace_count > 0 and curr_idx < len(text):
            if text[curr_idx] == "{":
                brace_count += 1
            elif text[curr_idx] == "}":
                brace_count -= 1
            curr_idx += 1
        text = text[:start_idx] + text[curr_idx:]
    return text

def remove_new_macro(text):
    pattern = re.compile(r"\\new\{")
    while True:
        match = pattern.search(text)
        if not match:
            break
        start_idx = match.start()
        brace_count = 1
        curr_idx = start_idx + 5  # '\\new{'
        while brace_count > 0 and curr_idx < len(text):
            if text[curr_idx] == "{":
                brace_count += 1
            elif text[curr_idx] == "}":
                brace_count -= 1
            curr_idx += 1
        inner_content = text[start_idx+5 : curr_idx-1]
        text = text[:start_idx] + inner_content + text[curr_idx:]
    return text

def replace_macro_with_formatting(text, name, start_fmt, end_fmt):
    pattern = re.compile(r"\\" + re.escape(name) + r"\{")
    while True:
        match = pattern.search(text)
        if not match:
            break
        start_idx = match.start()
        brace_count = 1
        curr_idx = start_idx + len(name) + 2  # '\\' + name + '{'
        while brace_count > 0 and curr_idx < len(text):
            if text[curr_idx] == "{":
                brace_count += 1
            elif text[curr_idx] == "}":
                brace_count -= 1
            curr_idx += 1
        inner = text[start_idx + len(name) + 2 : curr_idx - 1]
        inner = replace_macro_with_formatting(inner, name, start_fmt, end_fmt)
        text = text[:start_idx] + start_fmt + inner + end_fmt + text[curr_idx:]
    return text

def translate_citations(text):
    pattern = re.compile(r"\\cite\{([^}]+)\}")
    while True:
        match = pattern.search(text)
        if not match:
            break
        keys = match.group(1).split(",")
        formatted_keys = "; ".join([f"@{k.strip()}" for k in keys])
        text = text[:match.start()] + f"[{formatted_keys}]" + text[match.end():]
    return text

def translate_latex_to_md(text):
    # Handle literal \%
    text = text.replace(r"\%", "___LITERAL_PERCENT___")
    # Remove lines starting with % (possibly with spaces)
    lines = text.split("\n")
    clean_lines = []
    for line in lines:
        if "%" in line:
            parts = line.split("%", 1)
            line = parts[0]
        clean_lines.append(line.rstrip())
    text = "\n".join(clean_lines)
    text = text.replace("___LITERAL_PERCENT___", "%")

    # Remove specific macros completely from text
    text = remove_macro(text, "outline")
    text = remove_macro(text, "label")
    text = remove_macro(text, "keywords")
    text = remove_macro(text, "input")

    # Remove new macros, keeping their content
    text = remove_new_macro(text)

    # Format textit, textbf, textt, url
    text = replace_macro_with_formatting(text, "textit", "*", "*")
    text = replace_macro_with_formatting(text, "textbf", "**", "**")
    text = replace_macro_with_formatting(text, "texttt", "`", "`")
    text = replace_macro_with_formatting(text, "url", "<", ">")

    # Citations
    text = translate_citations(text)

    # Clean other LaTeX characters
    text = text.replace(r"~", " ")
    text = text.replace(r"\_", "_")
    text = text.replace(r"\&", "&")
    text = text.replace(r"\times", "×")
    text = text.replace(r"\approx", "≈")
    text = text.replace(r"\pm", "±")
    text = text.replace(r"\degree", "°")
    text = text.replace(r"\to", "→")
    text = text.replace(r"\rightarrow", "→")
    text = text.replace(r"\mu", "µ")
    text = text.replace(r"\textmu", "µ")
    text = text.replace(r"$\approx$", "≈")
    text = text.replace(r"$\pm$", "±")
    text = text.replace(r"$\times$", "×")
    text = text.replace(r"$\mu$", "µ")
    text = text.replace(r"$\rho$", "ρ")
    text = text.replace(r"$\to$", "→")
    text = text.replace(r"$\rightarrow$", "→")
    text = text.replace(r"$\le$", "≤")
    text = text.replace(r"$\ge$", "≥")
    text = text.replace(r"$\alpha$", "α")
    text = text.replace(r"$\bar{N}$", "N̄")

    return text.strip()


# --- STEP 4: Read and sync files ---

def write_draft(rel_path, content):
    abs_path = os.path.join(paper_dir, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Synced {rel_path}")

# 1. Abstract
with open(os.path.join(vibecount_dir, "includes/include-abstract.tex"), "r", encoding="utf-8") as f:
    abstract_text = f.read()
write_draft("abstract/draft.md", translate_latex_to_md(abstract_text))

# 2. Acknowledgements
with open(os.path.join(vibecount_dir, "includes/include-acknowledgement.tex"), "r", encoding="utf-8") as f:
    ack_text = f.read()
write_draft("acknowledgements/draft.md", translate_latex_to_md(ack_text))

# 3. Body Sections
with open(os.path.join(vibecount_dir, "includes/include-body.tex"), "r", encoding="utf-8") as f:
    body_text = f.read()

# Helper to clean paragraph list: remove empty strings, translate to md
def get_paragraphs(section_content):
    paras = re.split(r'\n\s*\n', section_content)
    clean_paras = []
    for p in paras:
        tr = translate_latex_to_md(p)
        if tr and tr.strip():
            clean_paras.append(tr)
    return clean_paras

def split_subsection(sub_raw):
    # Find matching closing brace of \subsection{Title}
    brace_count = 1
    curr_idx = 0
    while brace_count > 0 and curr_idx < len(sub_raw):
        if sub_raw[curr_idx] == "{":
            brace_count += 1
        elif sub_raw[curr_idx] == "}":
            brace_count -= 1
        curr_idx += 1
    sub_title = sub_raw[:curr_idx-1]
    sub_body = sub_raw[curr_idx:]
    return sub_title, sub_body

# Find Introduction
intro_match = re.search(r"\\section\{Introduction\}(.*?)\\section\{Results\}", body_text, re.DOTALL)
if intro_match:
    intro_content = intro_match.group(1)
    paras = get_paragraphs(intro_content)
    print(f"Found {len(paras)} paragraphs in Introduction:")
    for idx, p in enumerate(paras):
        print(f"  [{idx}]: {p[:60]}...")
        
    if len(paras) >= 5:
        write_draft("introduction/background/draft.md", paras[0])
        write_draft("introduction/hardware_problem/draft.md", paras[1])
        write_draft("introduction/problem_software/draft.md", paras[2])
        # Combine 4 and 5
        write_draft("introduction/vision_transformers/draft.md", paras[3] + "\n\n" + paras[4])
        # Combine 6 and 7 (or all remaining)
        solution_text = "\n\n".join(paras[5:])
        write_draft("introduction/solution/draft.md", solution_text)

# Find Results
results_match = re.search(r"\\section\{Results\}(.*?)\\section\{Discussion\}", body_text, re.DOTALL)
if results_match:
    results_content = results_match.group(1)
    # Split by subsection
    subsections = re.split(r"\\subsection\{", results_content)
    # The first element is before the first subsection (Results intro/overview)
    results_intro_paras = get_paragraphs(subsections[0])
    write_draft("results/draft.md", "\n\n".join(results_intro_paras))

    print(f"Found {len(subsections) - 1} subsections in Results")
    results_mappings = [
        ("workflow_overview", 1),
        ("detection_performance", 2),
        ("expert_concordance", 3),
        ("operator_benefit", 4),
        ("deployment_generalization", 5),
        ("retraining", 6),
        ("review_workflow", 7)
    ]

    for name, idx in results_mappings:
        if idx < len(subsections):
            sub_raw = subsections[idx]
            sub_title, sub_body = split_subsection(sub_raw)
            
            paras = get_paragraphs(sub_body)
            print(f"Subsection {name} has {len(paras)} paragraphs:")
            for p_idx, p in enumerate(paras):
                print(f"  [{p_idx}]: {p[:60]}...")
            
            if name == "deployment_generalization":
                if len(paras) >= 2:
                    write_draft("results/deployment_generalization/p1_scope/draft.md", paras[0])
                    write_draft("results/deployment_generalization/p2_burden/draft.md", "\n\n".join(paras[1:]))
                elif len(paras) == 1:
                    write_draft("results/deployment_generalization/p1_scope/draft.md", paras[0])
                    write_draft("results/deployment_generalization/p2_burden/draft.md", "")
            else:
                write_draft(f"results/{name}/draft.md", "\n\n".join(paras))

# Find Discussion
discussion_match = re.search(r"\\section\{Discussion\}(.*?)\\subsection\*\{Summary and Outlook\}", body_text, re.DOTALL)
if discussion_match:
    discussion_content = discussion_match.group(1)
    paras = get_paragraphs(discussion_content)
    print(f"Found {len(paras)} paragraphs in Discussion")
    write_draft("discussion/draft.md", "\n\n".join(paras))

# Find Methods
methods_match = re.search(r"\\section\{Methods\}(.*?)\\section\*\{Data and Code Availability\}", body_text, re.DOTALL)
if methods_match:
    methods_content = methods_match.group(1)
    # Split by subsection
    subsections = re.split(r"\\subsection\{", methods_content)
    
    print(f"Found {len(subsections) - 1} subsections in Methods")
    
    # Subsection 1: cell_culture
    if len(subsections) > 1:
        sub_raw = subsections[1]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 2:
            write_draft("methods/cell_culture/culture/draft.md", paras[0])
            write_draft("methods/cell_culture/sample_prep/draft.md", "\n\n".join(paras[1:]))
        elif len(paras) == 1:
            write_draft("methods/cell_culture/culture/draft.md", paras[0])
            write_draft("methods/cell_culture/sample_prep/draft.md", "")
            
    # Subsection 2: microscopy
    if len(subsections) > 2:
        sub_raw = subsections[2]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        write_draft("methods/microscopy/draft.md", "\n\n".join(paras))
        
    # Subsection 3: dataset_annotation
    if len(subsections) > 3:
        sub_raw = subsections[3]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 2:
            write_draft("methods/dataset_annotation/dataset/draft.md", paras[0])
            write_draft("methods/dataset_annotation/annotation_workflow/draft.md", "\n\n".join(paras[1:]))
        elif len(paras) == 1:
            write_draft("methods/dataset_annotation/dataset/draft.md", paras[0])
            write_draft("methods/dataset_annotation/annotation_workflow/draft.md", "")
            
    # Subsection 4: architecture_training
    if len(subsections) > 4:
        sub_raw = subsections[4]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 4:
            write_draft("methods/architecture_training/two_models/draft.md", paras[0] + "\n\n" + paras[1])
            write_draft("methods/architecture_training/training_procedure/draft.md", paras[2])
            write_draft("methods/architecture_training/augmentation/draft.md", paras[3])
        elif len(paras) == 3:
            write_draft("methods/architecture_training/two_models/draft.md", paras[0] + "\n\n" + paras[1])
            write_draft("methods/architecture_training/training_procedure/draft.md", paras[2])
            write_draft("methods/architecture_training/augmentation/draft.md", "")
        elif len(paras) == 2:
            write_draft("methods/architecture_training/two_models/draft.md", paras[0])
            write_draft("methods/architecture_training/training_procedure/draft.md", paras[1])
            write_draft("methods/architecture_training/augmentation/draft.md", "")
            
    # Subsection 5: baseline_benchmark
    if len(subsections) > 5:
        sub_raw = subsections[5]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 2:
            write_draft("methods/baseline_benchmark/detector_benchmark/draft.md", paras[0])
            write_draft("methods/baseline_benchmark/segmentation_comparison/draft.md", "\n\n".join(paras[1:]))
        elif len(paras) == 1:
            write_draft("methods/baseline_benchmark/detector_benchmark/draft.md", paras[0])
            write_draft("methods/baseline_benchmark/segmentation_comparison/draft.md", "")
            
    # Subsection 6: grid_tiling_merging
    if len(subsections) > 6:
        sub_raw = subsections[6]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 4:
            write_draft("methods/grid_tiling_merging/preprocess/draft.md", paras[0])
            write_draft("methods/grid_tiling_merging/tiling/draft.md", paras[1])
            write_draft("methods/grid_tiling_merging/nms/draft.md", paras[2])
            write_draft("methods/grid_tiling_merging/counts/draft.md", "\n\n".join(paras[3:]))
        elif len(paras) == 3:
            write_draft("methods/grid_tiling_merging/preprocess/draft.md", paras[0])
            write_draft("methods/grid_tiling_merging/tiling/draft.md", paras[1])
            write_draft("methods/grid_tiling_merging/nms/draft.md", paras[2])
            write_draft("methods/grid_tiling_merging/counts/draft.md", "")
            
    # Subsection 7: size_analysis
    if len(subsections) > 7:
        sub_raw = subsections[7]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        write_draft("methods/size_analysis/draft.md", "\n\n".join(paras))
        
    # Subsection 8: deployment_retraining
    if len(subsections) > 8:
        sub_raw = subsections[8]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        write_draft("methods/deployment_retraining/draft.md", "\n\n".join(paras))
        
    # Subsection 9: reproducibility_study
    if len(subsections) > 9:
        sub_raw = subsections[9]
        sub_title, sub_body = split_subsection(sub_raw)
        paras = get_paragraphs(sub_body)
        if len(paras) >= 3:
            write_draft("methods/reproducibility_study/design/draft.md", paras[0])
            write_draft("methods/reproducibility_study/tasks_and_stats/draft.md", paras[1])
            write_draft("methods/reproducibility_study/ethics/draft.md", "\n\n".join(paras[2:]))
        elif len(paras) == 2:
            write_draft("methods/reproducibility_study/design/draft.md", paras[0])
            write_draft("methods/reproducibility_study/tasks_and_stats/draft.md", paras[1])
            write_draft("methods/reproducibility_study/ethics/draft.md", "")
        elif len(paras) == 1:
            write_draft("methods/reproducibility_study/design/draft.md", paras[0])
            write_draft("methods/reproducibility_study/tasks_and_stats/draft.md", "")
            write_draft("methods/reproducibility_study/ethics/draft.md", "")

# Find Data Availability
da_match = re.search(r"\\section\*\{Data and Code Availability\}(.*?)\\section\*\{Author Contributions\}", body_text, re.DOTALL)
if da_match:
    da_content = da_match.group(1)
    paras = get_paragraphs(da_content)
    write_draft("data-availability/draft.md", "\n\n".join(paras))

# Find Author Contributions
ac_match = re.search(r"\\section\*\{Author Contributions\}(.*?)\\section\*\{Declaration", body_text, re.DOTALL)
if not ac_match:
    ac_match = re.search(r"\\section\*\{Author Contributions\}(.*?)\\section\*\{Conflict", body_text, re.DOTALL)
if ac_match:
    ac_content = ac_match.group(1)
    paras = get_paragraphs(ac_content)
    write_draft("author-contributions/draft.md", "\n\n".join(paras))

# Find Conflict of Interest
coi_match = re.search(r"\\section\*\{Conflict of Interest\}(.*)$", body_text, re.DOTALL)
if coi_match:
    coi_content = coi_match.group(1)
    paras = get_paragraphs(coi_content)
    write_draft("conflicts-of-interest/draft.md", "\n\n".join(paras))


# --- STEP 5: Apply semantic links between components ---
# We write the links directly to INDEX.md files of each components

def add_semantic_links(folder_rel, targets):
    index_path = os.path.join(paper_dir, folder_rel, "INDEX.md")
    if not os.path.exists(index_path):
        print(f"Warning: {index_path} not found")
        return
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # We find links: [] or existing links block and replace it
    links_yaml = "links:\n" + "\n".join([f"  - \"[[{t}]]\"" for t in targets])
    content_new = re.sub(r"links:\s*\[\]", links_yaml, content)
    if content == content_new and "links:" in content:
        content_new = re.sub(r"links:[\s\S]*?(?=\n\w+:|$)", links_yaml, content)
    
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content_new)
    print(f"Added links to {folder_rel}/INDEX.md: {targets}")

# Let's define the connections
links_definition = {
    # Intro
    "introduction/problem_software": ["detector_benchmark", "segmentation_comparison"],
    "introduction/vision_transformers": ["two_models", "query_capacity"],
    "introduction/solution": ["workflow_overview", "detection_performance", "operator_benefit", "retraining"],
    
    # Results
    "results/workflow_overview": ["preprocess", "tiling", "nms", "size_analysis"],
    "results/detection_performance": ["training_procedure", "detector_benchmark", "segmentation_comparison"],
    "results/expert_concordance": ["dataset", "annotation_workflow"],
    "results/operator_benefit": ["design", "tasks_and_stats"],
    "results/deployment_generalization": ["culture", "deployment_retraining"],
    "results/retraining": ["deployment_retraining"],
    "results/review_workflow": ["deployment_retraining", "size_analysis"],
    
    # Methods
    "methods/size_analysis": ["review_workflow"],
    "methods/deployment_retraining": ["retraining", "review_workflow"],
    "methods/reproducibility_study/design": ["operator_benefit"]
}

for folder, targets in links_definition.items():
    add_semantic_links(folder, targets)

print("Manuscript synchronized and semantic links created successfully!")
