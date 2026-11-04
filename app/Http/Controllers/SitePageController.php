<?php

namespace App\Http\Controllers;

use App\Support\SiteData;
use App\Support\VideoCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SitePageController extends Controller
{
    public function home(Request $request): Response { return $this->render('home', $request); }
    public function service(Request $request): Response { return $this->render('service', $request); }
    public function work(Request $request): Response { return $this->render('work', $request); }
    public function reviews(Request $request): Response { return $this->render('reviews', $request); }
    public function team(Request $request): Response { return $this->render('team', $request); }
    public function booking(Request $request): Response { return $this->render('booking', $request); }

    private function render(string $page, Request $request): Response
    {
        if ($request->boolean('cms_preview') && !DB::table('users')->where('id', $request->session()->get('admin_user_id'))->exists()) {
            abort(403);
        }

        $data = VideoCatalog::hydrate(SiteData::all());
        $snapshot = $this->snapshot($data);
        $snapshotJson = json_encode($snapshot, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $bootstrap = [
            'mm_svc_catalog_v1' => $this->catalog($data),
            'mm_team_db_v1' => $snapshot['/api/public/team'] ?? $data['team'],
            'mm_bookings_v1' => $data['bookings'],
        ];
        $bootstrapJson = json_encode($bootstrap, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $pageContentJson = json_encode($data['settings']['page_content'][$page] ?? [], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $base = json_encode(url('/'), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
        $publicVideosJson = json_encode(VideoCatalog::records(true), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $settings = $data['settings'] ?? [];
        $purchaseInfo = $settings['purchase'] ?? [];
        $homeSections = $settings['home_sections'] ?? $this->defaultHomeSections();
        $homeSectionsJson = json_encode($homeSections, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $homeMediaJson = json_encode($settings['home_media'] ?? [], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $siteSettingsJson = json_encode([
            'seo' => $settings['seo'] ?? [],
            'logo_url' => $settings['logo_url'] ?? '',
            'favicon_url' => $settings['favicon_url'] ?? '',
            'footer' => $settings['footer'] ?? [],
            'social' => $settings['social'] ?? [],
        ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $bridgeScript = $this->bridgeScript($bootstrapJson, $page, $pageContentJson, $base, $homeSectionsJson, $homeMediaJson, $siteSettingsJson);
        $serviceIntro = (string) ($data['settings']['content']['services_intro'] ?? 'Explore the MEXA MOTION service catalogue and choose the editing package that fits your project.');
        $html = view('pages.'.$page, compact('page', 'snapshotJson', 'bridgeScript', 'publicVideosJson', 'serviceIntro', 'purchaseInfo'))->render();

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    private function snapshot(array $data): array
    {
        $snapshotPath = database_path('seeders/data/site-snapshot.json');
        $snapshot = is_file($snapshotPath) ? json_decode(file_get_contents($snapshotPath), true) : [];
        $settings = $data['settings'] ?? [];
        $content = $settings['content'] ?? [];
        if (!empty($content['overview_video_url'])) {
            $overview = \App\Support\VideoEmbed::resolve((string) $content['overview_video_url']);
            $content['overview_video_embed_type'] = $overview['type'];
            $content['overview_video_embed_url'] = $overview['embed_url'];
            $content['overview_video_provider'] = $overview['provider'];
        }
        $team = $data['team'] ?? [];
        $team['members'] = SiteData::sortRecords(array_values(array_filter($team['members'] ?? [], fn ($row) => !in_array($row['is_active'] ?? true, [false, 0, '0'], true))), 'sort_order');
        $work = SiteData::publishedPortfolio($data['portfolio'] ?? []);
        foreach (['items', 'demos', 'shorts', 'recent', 'videos'] as $key) {
            $urlKey = $key === 'videos' ? 'video_url' : 'url';
            $work[$key] = array_map(fn ($item) => \App\Support\VideoEmbed::decorateItem($item, $urlKey), $work[$key] ?? []);
        }
        $activeServices = SiteData::sortRecords(array_values(array_filter($data['services'] ?? [], fn ($row) => !in_array($row['active'] ?? true, [false, 0, '0'], true))), 'display_order', 'sort_order');
        $services = \App\Support\VideoEmbed::decorateServices($activeServices);
        $approvedReviews = array_values(array_filter($data['reviews'] ?? [], fn ($row) => ($row['status'] ?? 'pending') === 'approved'));
        if (count(array_filter($approvedReviews, fn ($row) => array_key_exists('display_order', $row))) > 0) {
            $approvedReviews = SiteData::sortRecords($approvedReviews, 'display_order');
        }
        $ratings = array_map(fn ($r) => (int) ($r['rating'] ?? 5), $approvedReviews);
        $seedReviews = SiteData::defaults()['reviews'] ?? [];
        $storedReviewStats = $settings['review_stats'] ?? [];
        $reviewStats = count($approvedReviews) === count($seedReviews) && count(array_filter($approvedReviews, fn ($r) => str_starts_with((string) ($r['created_at'] ?? ''), '2026-10-'))) === count($seedReviews)
            ? $storedReviewStats
            : ['count' => count($approvedReviews), 'average' => count($ratings) ? round(array_sum($ratings) / count($ratings), 1) : 0, 'five' => count(array_filter($ratings, fn ($rating) => $rating === 5))];

        $snapshot['/api/public/content'] = $content;
        $snapshot['/api/public/services'] = ['services' => $services];
        $snapshot['/api/public/packages'] = ['packages' => SiteData::publishedPackages()];
        $snapshot['/api/public/team'] = $team;
        $snapshot['/api/public/work'] = $work;
        $snapshot['/api/public/reviews'] = [
            'items' => $approvedReviews,
            'stats' => $reviewStats,
            'settings' => [
                'review_heading' => $content['review_heading'] ?? 'Client Reviews',
                'review_hero_image' => $content['review_hero_image'] ?? '',
                'review_hero_desc' => $content['review_hero_desc'] ?? '',
            ],
            'offset' => 0,
            'limit' => 20,
        ];
        $snapshot['/api/public/content']['purchase'] = $settings['purchase'] ?? [];
        $snapshot['/api/public/contact'] = array_replace($settings['contact'] ?? [], [
            'purchase' => $settings['purchase'] ?? [],
            'social' => $settings['social'] ?? [],
        ]);
        $snapshot['/api/public/videos'] = ['videos' => VideoCatalog::records(true)];

        return $snapshot;
    }

    private function catalog(array $data): array
    {
        $services = [];
        $packages = SiteData::publishedPackages();

        $activeServices = array_values(array_filter($data['services'] ?? [], fn ($row) => !in_array($row['active'] ?? true, [false, 0, '0'], true)));
        $orderedServices = SiteData::sortRecords($activeServices, 'display_order', 'sort_order');
        foreach (\App\Support\VideoEmbed::decorateServices($orderedServices) as $service) {
            $features = $service['features'] ?? preg_split('/\R/', (string) ($service['bullet_points'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);
            $serviceId = (int) ($service['id'] ?? (count($services) + 1));
            $base = (float) ($service['priceFrom'] ?? $service['price_from'] ?? 40);
            $currency = $service['currency'] ?? 'USD';
            $services[] = [
                'id' => $serviceId,
                'name' => $service['name'] ?? 'Service',
                'label' => $service['label'] ?? $service['category'] ?? 'Service',
                'subtitle' => $service['subtitle'] ?? $service['description'] ?? '',
                'description' => $service['longDescription'] ?? $service['long_description'] ?? $service['description'] ?? '',
                'features' => array_values($features ?: []),
                'deliverables' => $service['deliverables'] ?? '',
                'priceFrom' => $base,
                'currency' => $currency,
                'icon' => $service['icon'] ?? 'fa-solid fa-video',
                'media' => [
                    'type' => $service['media']['type'] ?? $service['media_type'] ?? (!empty($service['image_url']) ? 'image' : (!empty($service['main_video_url']) ? 'video' : 'none')),
                    'imageUrl' => $service['media']['imageUrl'] ?? $service['image_url'] ?? '',
                    'videoUrl' => $service['media']['videoUrl'] ?? $service['main_video_url'] ?? '',
                    'thumbnail' => $service['media']['thumbnail'] ?? $service['video_thumbnail'] ?? '',
                    'embedType' => $service['media']['embedType'] ?? $service['main_video_embed_type'] ?? '',
                    'embedUrl' => $service['media']['embedUrl'] ?? $service['main_video_embed_url'] ?? '',
                    'provider' => $service['media']['provider'] ?? $service['main_video_provider'] ?? '',
                ],
                'active' => !in_array($service['active'] ?? true, [false, 0, '0'], true),
            ];

        }

        return ['version' => 1, 'services' => $services, 'packages' => $packages];
    }

    private function defaultHomeSections(): array
    {
        return [
            ['key' => 'hero', 'label' => 'Hero', 'selector' => '#home', 'enabled' => true, 'order' => 1],
            ['key' => 'services', 'label' => 'Services', 'selector' => '#services', 'enabled' => true, 'order' => 2],
            ['key' => 'work', 'label' => 'Featured work', 'selector' => '#portfolio', 'enabled' => true, 'order' => 3],
            ['key' => 'process', 'label' => 'Our process', 'selector' => '#process', 'enabled' => true, 'order' => 4],
            ['key' => 'reviews', 'label' => 'Reviews', 'selector' => '#reviews', 'enabled' => true, 'order' => 5],
            ['key' => 'team', 'label' => 'Team', 'selector' => '#team', 'enabled' => true, 'order' => 6],
            ['key' => 'about', 'label' => 'About', 'selector' => '#about', 'enabled' => true, 'order' => 7],
            ['key' => 'contact', 'label' => 'Contact', 'selector' => '#contact', 'enabled' => true, 'order' => 8],
        ];
    }

    private function bridgeScript(string $bootstrapJson, string $page, string $overridesJson, string $baseJson, string $homeSectionsJson, string $homeMediaJson, string $siteSettingsJson): string
    {
        $pageJson = json_encode($page, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

        return '(function(){"use strict";var base='.$baseJson.';if(base.slice(-1)!=="/")base+="/";var seed='.$bootstrapJson.';var page='.$pageJson.';var overrides='.$overridesJson.';var homeSections='.$homeSectionsJson.';var homeMedia='.$homeMediaJson.';var siteSettings='.$siteSettingsJson.';var meta=document.querySelector("meta[name=csrf-token]");var token=meta?meta.content:"";var nativeFetch=window.fetch.bind(window);window.fetch=function(input,options){var raw=typeof input==="string"?input:(input&&input.url)||"";if(raw.charAt(0)!=="/"||raw.indexOf("//")===0)return nativeFetch(input,options);var target=new URL(raw.slice(1),base).toString();return nativeFetch(typeof input==="string"?target:new Request(target,input),options);};try{Object.keys(seed).forEach(function(k){localStorage.setItem(k,JSON.stringify(seed[k]));});}catch(e){}var set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(k==="mm_bookings_v1"){try{fetch(base+"api/public/storage",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","X-CSRF-TOKEN":token},body:JSON.stringify({key:k,value:JSON.parse(v)})}).catch(function(){});}catch(e){}}};function applyOverrides(){Object.keys(overrides||{}).forEach(function(selector){var data=overrides[selector];var el;try{el=document.querySelector(selector);}catch(e){return;}if(!el)return;if(data.text!==undefined&&(data.replace===true||el.children.length===0)&&el.textContent!==data.text)el.textContent=data.text;if(data.label!==undefined){var labelNode=[...el.childNodes].find(function(node){return node.nodeType===3;});if(labelNode)labelNode.nodeValue=" "+data.label+" ";else el.insertBefore(document.createTextNode(data.label),el.firstChild);}if(el.tagName==="IMG"){if(data.src!==undefined)el.setAttribute("src",data.src);if(data.alt!==undefined)el.setAttribute("alt",data.alt);}if(el.tagName==="A"&&data.href!==undefined)el.setAttribute("href",data.href);if(data.title!==undefined)el.setAttribute("title",data.title);});}function applyHome(){if(page!=="home")return;var roots={hero:"#home",services:"#services",work:"#portfolio",process:"#process",reviews:"#reviews",team:"#team",about:"#about",contact:"#contact"};var entries=(Array.isArray(homeSections)?homeSections:[]).slice().sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});var nodes=[];entries.forEach(function(item){var node=document.querySelector(roots[item.key]||item.selector);if(!node)return;node.hidden=item.enabled===false||item.enabled===0||item.enabled==="0";node.style.display=node.hidden?"none":"";nodes.push(node);});if(nodes.length>1){var ordered=entries.filter(function(item){return roots[item.key]||item.selector;}).map(function(item){return document.querySelector(roots[item.key]||item.selector);}).filter(Boolean);var current=nodes.slice().sort(function(a,b){return a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;});if(ordered.some(function(node,index){return current[index]!==node;})){var parent=ordered[0].parentNode;var anchor=ordered[0].nextSibling;while(anchor&&ordered.indexOf(anchor)>=0)anchor=anchor.nextSibling;var fragment=document.createDocumentFragment();ordered.forEach(function(node){fragment.appendChild(node);});if(anchor&&anchor.parentNode===parent)parent.insertBefore(fragment,anchor);else parent.appendChild(fragment);}}var hero=document.querySelector("#home");if(hero&&homeMedia){if(homeMedia.image){hero.style.backgroundImage="linear-gradient(120deg,rgba(5,24,56,.78),rgba(5,24,56,.24)),url(\""+String(homeMedia.image).replace(/[\"\\\\]/g,"")+"\")";hero.style.backgroundSize="cover";hero.style.backgroundPosition="center";}var video=String(homeMedia.video||"");if(video&&/\\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(video)){var player=hero.querySelector("video[data-home-background]");if(!player){player=document.createElement("video");player.dataset.homeBackground="1";player.autoplay=true;player.muted=true;player.loop=true;player.playsInline=true;player.setAttribute("aria-hidden","true");player.style.cssText="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none";hero.insertBefore(player,hero.firstChild);}if(player.src!==video)player.src=video;}}}function applyGlobal(){if(siteSettings.seo&&siteSettings.seo.title)document.title=siteSettings.seo.title;var description=siteSettings.seo&&siteSettings.seo.description;if(description){var tag=document.querySelector("meta[name=description]");if(!tag){tag=document.createElement("meta");tag.name="description";document.head.appendChild(tag);}tag.content=description;}if(siteSettings.favicon_url){var icon=document.querySelector("link[rel~=icon]")||document.createElement("link");icon.rel="icon";icon.href=siteSettings.favicon_url;document.head.appendChild(icon);}if(siteSettings.logo_url){document.querySelectorAll("#header img,header img,.site-logo img,.brand img,a[href=\"/\"] img,img[alt*=\"Mexa\"]").forEach(function(img){img.src=siteSettings.logo_url;});}var footer=siteSettings.footer||{};if(footer.copyright){document.querySelectorAll("footer p").forEach(function(item){if(/©|copyright/i.test(item.textContent))item.textContent=footer.copyright;});}var social=siteSettings.social||{};var socialIcons={facebook:"facebook",instagram:"instagram",youtube:"youtube",linkedin:"linkedin",telegram:"telegram",whatsapp:"whatsapp"};Object.keys(socialIcons).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(social,key))return;var icon=socialIcons[key];var link=document.querySelector("a[data-social=\""+key+"\"]")||Array.from(document.querySelectorAll("a")).find(function(item){return item.querySelector("[class*=\""+icon+"\"]")||String(item.className).includes(icon);});if(!link)return;if(social[key]){link.href=social[key];link.hidden=false;}else link.hidden=true;});}function apply(){applyOverrides();applyHome();applyGlobal();}apply();new MutationObserver(function(){applyOverrides();applyGlobal();}).observe(document.body,{subtree:true,childList:true});if(new URLSearchParams(location.search).get("cms_preview")==="1"){var style=document.createElement("style");style.textContent="[data-mexa-hover]{outline:2px solid #3184ff!important;outline-offset:3px!important;cursor:crosshair!important}";document.head.appendChild(style);function selector(el){if(el.id)return "#"+CSS.escape(el.id);var parts=[];while(el&&el.nodeType===1&&el!==document.body){var part=el.tagName.toLowerCase();if(el.classList.length)part+="."+[...el.classList].slice(0,3).map(CSS.escape).join(".");var siblings=el.parentElement?[...el.parentElement.children].filter(function(n){return n.tagName===el.tagName;}):[];if(siblings.length>1)part+=":nth-of-type("+(siblings.indexOf(el)+1)+")";parts.unshift(part);el=el.parentElement;if(el&&el.id){parts.unshift("#"+CSS.escape(el.id));break;}}return parts.join(" > ");}document.addEventListener("mouseover",function(e){var el=e.target.closest("body *");if(!el||/^(SCRIPT|STYLE|SVG|PATH|HTML)$/.test(el.tagName))return;document.querySelectorAll("[data-mexa-hover]").forEach(function(n){n.removeAttribute("data-mexa-hover");});el.setAttribute("data-mexa-hover","1");},true);document.addEventListener("click",function(e){var el=e.target.closest("body *");if(!el||/^(SCRIPT|STYLE|SVG|PATH|HTML)$/.test(el.tagName))return;e.preventDefault();e.stopImmediatePropagation();var tag=el.tagName;parent.postMessage({type:"mexa-cms-select",page:page,selector:selector(el),tag:tag,text:el.children.length===0?el.textContent.trim():"",href:tag==="A"?el.getAttribute("href"):"",src:tag==="IMG"?el.getAttribute("src"):"",alt:tag==="IMG"?el.getAttribute("alt"):"",title:el.getAttribute("title")||""},location.origin);},true);}})();';
    }
}
