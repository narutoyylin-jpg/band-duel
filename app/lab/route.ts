export function GET(request:Request){
 const destination=new URL('https://heterojunction-band-lab.opeuertio.chatgpt.site/');
 destination.search=new URL(request.url).search;
 return new Response(null,{status:302,headers:{Location:destination.href,'Cache-Control':'no-cache'}});
}
