"""Compare collected runtime source bytes with the pinned reproduction images."""
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tarfile

root = pathlib.Path(__file__).resolve().parent.parent
images = {
    "6.0.9": "emscripten/emsdk@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc",
    "6.0.10": "emscripten/emsdk@sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65",
}
omitted = sorted([
    "system/lib/libcxx/.gitignore", "system/lib/libcxx/modules/.clang-format",
    "system/lib/libcxx/src/.clang-tidy", "system/lib/libcxxabi/src/demangle/.clang-format",
    "system/lib/libunwind/.clang-format", "system/lib/llvm-libc/src/.clang-tidy",
    "system/lib/llvm-libc/src/__support/CPP/.clang-tidy",
])
probe = """import pathlib,hashlib,json
r=pathlib.Path('/emsdk/upstream/emscripten')
files=[r/'LICENSE',r/'AUTHORS']+[p for d in ['src','system'] for p in (r/d).rglob('*') if p.is_file()]
print(json.dumps({str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}))
"""
manifest = json.loads((root/'release/pdfjs-nested-source.json').read_text())
results = []
for version, image in images.items():
    name = 'emscripten-' + version.replace('.', '-')
    record = next(r for r in manifest['records'] if r['name'] == name)
    data = (root/'build/pdfjs-nested-source'/record['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == record['sha256'], 'Source archive changed'
    expected = {}
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            path = member.name.split('/', 1)[-1]
            if member.isfile() and (path in ['LICENSE', 'AUTHORS'] or path.startswith(('src/', 'system/'))):
                expected[path] = hashlib.sha256(archive.extractfile(member).read()).hexdigest()
    actual = json.loads(subprocess.check_output([
        'docker', 'run', '--rm', '--pull=never', '--network', 'none', '--platform', 'linux/amd64',
        image, 'python3', '-c', probe,
    ]))
    assert sorted(set(expected) - set(actual)) == omitted, 'Unexpected omitted source files'
    assert not set(actual) - set(expected), 'Image contains unsupplied runtime files'
    assert all(actual[p] == expected[p] for p in actual), 'Runtime source bytes differ'
    results.append(dict(version=version, image=image, archiveSha256=record['sha256'],
                        matchedFiles=len(actual), archiveOnlyConfigurationFiles=omitted))
report = dict(scope='Runtime src/system and top-level notices only; not complete compiler-image source or build verification.', results=results)
text = json.dumps(report, indent=2) + '\n'
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(text)
print(text)
