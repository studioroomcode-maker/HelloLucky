"""Collect bounded, provenance-tracked clover image candidates; never auto-label."""
import concurrent.futures, hashlib, html, io, json, re, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent/'datasets_raw'/'web-candidates'
ROOT.mkdir(parents=True,exist_ok=True)
HEADERS={'User-Agent':'HelloLuckyDataset/1.0 (local clover research; bounded downloads)'}
def get(url):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=35) as r:
        data=r.read(20*1024*1024+1)
        if len(data)>20*1024*1024: raise ValueError('File exceeds 20 MB limit')
        return data

def search(term,n):
    q={'action':'query','format':'json','generator':'search','gsrsearch':term,'gsrnamespace':6,'gsrlimit':n,'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':1200}
    return list(json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(q))).get('query',{}).get('pages',{}).values())

def collect():
    entries=[]
    cache=ROOT/'commons-search.json'
    if cache.exists():
        existing=json.loads(cache.read_text(encoding='utf-8'))
    else:
        pages=search('four leaf clover filetype:bitmap',50)
        existing={'query':{'pages':{str(p['pageid']):p for p in pages}}}
        cache.write_text(json.dumps(existing),encoding='utf-8')
    groups=[('four_leaf_candidate',list(existing.get('query',{}).get('pages',{}).values()))]
    for tag,query in [('field_background_candidate','intitle:Trifolium intitle:repens filetype:bitmap'),('field_background_candidate','clover lawn filetype:bitmap -catalogue -seeds -book')]:
        try: groups.append((tag,search(query,60)))
        except Exception as e: print('Search failed:',str(e),flush=True)
    seen=set()
    excluded=[]
    for tag,pages in groups:
        for p in pages:
            info=p.get('imageinfo',[{}])[0]; url=info.get('thumburl') or info.get('url','')
            title=p.get('title',''); meta=info.get('extmetadata',{})
            if url in seen: continue
            seen.add(url)
            if not re.search(r'\.(jpg|jpeg|png|webp)$',title,re.I):
                excluded.append(title);continue
            if not re.search(r'\.(jpg|jpeg|png|webp)(?:$|\?)',url,re.I): continue
            if re.search(r'logo|icon|coat of arms|flag|diagram|drawing|illustration|oxalis|marsilea|jewel|embroid|symbol|catalog|seed annual|keychain|trail signs|Warunadwipa|\(PSF\)',title,re.I):
                excluded.append(title);continue
            entries.append({'id':'commons_'+str(p['pageid']),'category':tag,'title':title,'image_url':url,'source_url':info.get('descriptionurl'),'license':meta.get('LicenseShortName',{}).get('value','unknown'),'license_url':meta.get('LicenseUrl',{}).get('value',''),'artist':meta.get('Artist',{}).get('value',''),'description':meta.get('ImageDescription',{}).get('value',''),'review_status':'unreviewed','label_status':'none'})
    pins=['305752262213364307','308567011961519231','863917141000265720','584131014204951106','234327986857295227','290060032273219444','308567011961519116','704320829220584793','63877159676968249','743727325996266805','419327415324977241']
    for pin in pins:
        try:
            source='https://kr.pinterest.com/pin/'+pin+'/'
            s=get(source).decode('utf-8');tags=re.findall(r'<meta[^>]+>',s)
            t=next(t for t in tags if 'property="og:image"' in t)
            u=html.unescape(re.search(r'content="([^"]+)"',t).group(1))
            title=next((html.unescape(re.search(r'content="([^"]*)"',t).group(1)) for t in tags if 'property="og:title"' in t),'')
            if re.search(r'drawing|illustration|wallpaper',title,re.I):
                excluded.append(title);continue
            entries.append({'id':'pinterest_'+pin,'category':'four_leaf_candidate','title':title,'image_url':u,'source_url':source,'license':'unverified','review_status':'unreviewed','label_status':'none'})
        except Exception as e: print('Pin unavailable:',pin,str(e),flush=True)
    (ROOT/'candidates.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Download candidates:',len(entries),flush=True)
    hashes=set();results=[]
    def download(e):
        try:
            suffix=Path(urllib.parse.urlparse(e['image_url']).path).suffix.lower()
            p=ROOT/'images'/(e['id']+suffix);p.parent.mkdir(exist_ok=True)
            data=p.read_bytes() if p.exists() else get(e['image_url'])
            im=Image.open(io.BytesIO(data));im.verify();im=Image.open(io.BytesIO(data))
            if min(im.size)<240: raise ValueError('Too small: '+str(im.size))
            e.update(width=im.width,height=im.height,sha256=hashlib.sha256(data).hexdigest(),pixel_hash=hashlib.sha256(im.convert('RGB').tobytes()).hexdigest(),file='images/'+p.name,bytes=len(data))
            return e,data,p
        except Exception as ex:
            e.update(download_status='failed',error=str(ex));return e,None,None
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for e,data,p in pool.map(download,entries):
            if data is not None:
                if e['pixel_hash'] in hashes: e['download_status']='duplicate';e.pop('file',None)
                else:
                    hashes.add(e['pixel_hash']);p.write_bytes(data);e['download_status']='downloaded'
            results.append(e)
            print(len(results),e['id'],e['download_status'],flush=True)
    (ROOT/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    good=[e for e in results if e['download_status']=='downloaded']
    rows=[]
    for e in good:
        rows.append('<article><img loading="lazy" src="'+html.escape(e['file'])+'"><p>'+html.escape(e['id'])+' | '+str(e['width'])+'x'+str(e['height'])+'</p><p>'+html.escape(e['category'])+'</p><a href="'+html.escape(e['source_url'])+'">'+html.escape(e['title'])+'</a><p>'+html.escape(e['license'])+'</p></article>')
    (ROOT/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Clover candidates</title><style>body{font:14px sans-serif;background:#eee;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}article{background:white;padding:12px;overflow-wrap:anywhere}img{width:100%;height:240px;object-fit:contain}</style><h1>Clover image candidates</h1><p>Unreviewed. Titles are not labels. Verify leaf count, photo authenticity, background targets and duplicates before training. Keep source derivatives in one split.</p><main>'+''.join(rows)+'</main>',encoding='utf-8')
    summary={'downloaded':len(good),'duplicates':sum(e['download_status']=='duplicate' for e in results),'failed':sum(e['download_status']=='failed' for e in results),'bytes':sum(e['bytes'] for e in good),'categories':{k:sum(e['category']==k for e in good) for k in ['four_leaf_candidate','field_background_candidate']},'title_exclusions':excluded,'training_started':False}
    (ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=True),flush=True)
if __name__=='__main__':collect()
