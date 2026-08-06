(function () {
  "use strict";
  const cards = Array.from(document.querySelectorAll("#reviews blockquote"));
  if (!cards.length) return;
  const endpoint = "https://firestore.googleapis.com/v1/projects/catgroup-8d0bb/databases/(default)/documents:runQuery";
  const query = { structuredQuery:{ from:[{collectionId:"publicGuestReviews"}], orderBy:[{field:{fieldPath:"displayOrderAt"},direction:"DESCENDING"}], limit:6 } };
  const value = field => field?.stringValue ?? field?.integerValue;
  fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(query)})
    .then(response=>{if(!response.ok)throw new Error("review_fetch_failed");return response.json();})
    .then(rows=>rows.map(row=>row.document?.fields).filter(Boolean).map(fields=>({rating:Number(value(fields.rating)),message:String(value(fields.message)||""),alias:String(value(fields.publicAlias)||"")})).filter(review=>Number.isInteger(review.rating)&&review.rating>=1&&review.rating<=5&&review.message.length>=2&&review.message.length<=1500&&review.alias.length>=1&&review.alias.length<=40))
    .then(reviews=>{reviews.slice(0,cards.length).forEach((review,index)=>{const card=cards[index],stars=card.querySelector(".stars"),text=card.querySelector(".review-text"),note=card.querySelector(".review-note");if(!stars||!text||!note)return;stars.textContent="★".repeat(review.rating)+"☆".repeat(5-review.rating);stars.setAttribute("aria-label",`${review.rating} 顆星`);text.textContent=review.message;note.textContent=`${review.alias}｜訪客體驗`;});})
    .catch(()=>{}); // Static reviews are the intentional full fallback.
})();
