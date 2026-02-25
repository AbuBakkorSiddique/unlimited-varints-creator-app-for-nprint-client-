import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { Buffer } from "node:buffer";

export const action = async ({ request }) => {
  console.log("--- 🚀 App Proxy Request Started ---");

  try {
    const { admin } = await authenticate.public.appProxy(request);
    const body = await request.json();
    const { variantId, totalPrice, fileName, imageData, properties } = body;

    console.log("📦 Payload Received:", { fileName, variantId, hasImageData: !!imageData });

    let finalFileUrl = "";

    // --- STEP 1: STAGED UPLOAD CREATE ---
    if (imageData && fileName) {
      try {
        console.log("⏳ Step 1: Requesting Staged Upload URL from Shopify...");
        
        const stagedRes = await admin.graphql(`#graphql
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters { name value }
              }
              userErrors { field message }
            }
          }`, {
          variables: {
            input: [{
              filename: fileName,
              mimeType: "image/png",
              httpMethod: "POST",
              resource: "IMAGE"
            }]
          }
        });

        const stagedJson = await stagedRes.json();
        const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];

        if (!target) {
          console.error("❌ Failed to get Staged Target:", stagedJson.errors || stagedJson.data.stagedUploadsCreate.userErrors);
        } else {
          console.log("✅ Staged Target Received. ResourceURL:", target.resourceUrl);

          // --- STEP 2: GOOGLE CLOUD UPLOAD ---
          console.log("⏳ Step 2: Uploading Binary to Google Cloud...");
          const base64Data = imageData.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');

          const fileUploadBody = new FormData();
          target.parameters.forEach(p => fileUploadBody.append(p.name, p.value));
          
          const fileBlob = new Blob([buffer], { type: "image/png" });
          fileUploadBody.append("file", fileBlob);

          const uploadResponse = await fetch(target.url, {
            method: "POST",
            body: fileUploadBody,
          });

          if (uploadResponse.ok || uploadResponse.status === 201) {
            console.log("✅ Image Uploaded to GCS successfully.");

            // --- STEP 3: FILE CREATE (REGISTERING IMAGE) ---
            console.log("⏳ Step 3: Registering Image in Shopify Files...");
            const fileCreateRes = await admin.graphql(`#graphql
              mutation fileCreate($files: [FileCreateInput!]!) {
                fileCreate(files: $files) {
                  files {
                    fileStatus
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
                  userErrors { field message }
                }
              }`, {
              variables: { 
                files: [{ 
                  originalSource: target.resourceUrl, 
                  contentType: "IMAGE" 
                }] 
              }
            });

            const fileCreateJson = await fileCreateRes.json();
            const createdFile = fileCreateJson.data?.fileCreate?.files?.[0];

            if (createdFile && createdFile.image) {
              finalFileUrl = createdFile.image.url;
              console.log("✨ Step 3 Success! CDN URL:", finalFileUrl);
            } else {
              console.warn("⚠️ File is still processing. Using ResourceURL as fallback.");
              finalFileUrl = target.resourceUrl; 
            }
          } else {
            console.error("❌ GCS Upload Failed. Status:", uploadResponse.status);
          }
        }
      } catch (err) {
        console.error("❌ Image Upload Process Error:", err.message);
      }
    }

    // --- STEP 4: DRAFT ORDER CREATION ---
    console.log("⏳ Step 4: Creating Draft Order...");
    const finalProperties = Object.keys(properties || {}).map(key => ({
      key: key,
      value: properties[key].toString()
    }));

    finalProperties.push({ 
      key: "Design Link", 
      value: finalFileUrl || "No Design Image" 
    });

    const draftRes = await admin.graphql(`#graphql
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder { id invoiceUrl }
          userErrors { field message }
        }
      }`, {
      variables: {
        input: {
          lineItems: [{
            variantId: variantId.includes("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`,
            quantity: 1,
            customAttributes: finalProperties
          },
          {
            title: "Customization Charge",
            quantity: 1,
            originalUnitPrice: parseFloat(totalPrice).toFixed(2)
          }],
          note: `Customer Design URL: ${finalFileUrl}`
        }
      }
    });

    const draftData = await draftRes.json();
    const result = draftData.data?.draftOrderCreate;

    if (result?.draftOrder) {
      console.log("🎉 SUCCESS! Invoice URL:", result.draftOrder.invoiceUrl);
      return data({ url: result.draftOrder.invoiceUrl });
    } else {
      console.error("❌ Draft Order Errors:", result?.userErrors);
      return data({ error: "Draft Order Failed" }, { status: 400 });
    }

  } catch (error) {
    console.error("‼️ Critical Global Error:", error.message);
    return data({ error: error.message }, { status: 500 });
  }
};